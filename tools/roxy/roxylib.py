# Shared Blender helpers for the Roxy figure build (import after read_factory_settings).
import math, os
import bpy, bmesh
from mathutils import Vector, Matrix, Euler
from mathutils.bvhtree import BVHTree
scene = bpy.context.scene
col = scene.collection

def srgb(hexstr):
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]

# ------------------------------------------------------------------ helpers
def link(obj, parent=None):
    col.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj

def empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None)
    link(e, parent)
    if parent:
        bpy.context.view_layer.update()
        e.location = parent.matrix_world.inverted() @ Vector(loc)
    else:
        e.location = loc
    return e

def smooth(obj, on=True):
    obj.data.polygons.foreach_set('use_smooth', [on] * len(obj.data.polygons))

def mesh_obj(name, bm, material, parent=None, smooth_on=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.data.materials.append(material)
    link(obj)
    if parent:
        bpy.context.view_layer.update()
        world = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    smooth(obj, smooth_on)
    return obj

def apply_all(obj):
    bpy.context.view_layer.objects.active = obj
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return obj

def skin_body(name, verts, edges, radii, material, subdiv=2):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, edges, [])
    obj = bpy.data.objects.new(name, me)
    link(obj)
    sk = obj.modifiers.new('skin', 'SKIN')
    sk.use_smooth_shade = True
    for i, r in enumerate(radii):
        v = me.skin_vertices[''].data[i]
        v.radius = r if isinstance(r, tuple) else (r, r)
    me.skin_vertices[''].data[0].use_root = True
    ss = obj.modifiers.new('sub', 'SUBSURF')
    ss.levels = subdiv
    ss.render_levels = subdiv
    apply_all(obj)
    obj.data.materials.append(material)
    smooth(obj)
    return obj

def assign_by(obj, rules):
    """rules: list of (material, predicate(center)) applied in order; first match wins."""
    mats = []
    for m, _ in rules:
        if m.name not in [x.name for x in obj.data.materials]:
            obj.data.materials.append(m)
    names = [x.name for x in obj.data.materials]
    mw = obj.matrix_world
    for p in obj.data.polygons:
        c = mw @ p.center
        for m, pred in rules:
            if pred(c):
                p.material_index = names.index(m.name)
                break

def lathe(name, profile, material, segments=48, center=(0, 0, 0), radial=None, parent=None, cap=False, smooth_on=True):
    """profile: [(r, z)] from top to bottom; radial(theta, r, z) -> (r, dz) optional."""
    bm = bmesh.new()
    rings = []
    for (r, z) in profile:
        ring = []
        for i in range(segments):
            t = 2 * math.pi * i / segments
            rr, dz = (radial(t, r, z) if radial else (r, 0.0))
            ring.append(bm.verts.new((center[0] + rr * math.cos(t), center[1] + rr * math.sin(t), center[2] + z + dz)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for i in range(segments):
            j = (i + 1) % segments
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap:
        for ring in (rings[0], rings[-1]):
            if ring[0].co.xy.length > 1e-6:
                bm.faces.new(ring)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, material, parent, smooth_on)

def ellipsoid(name, loc, scale, material, rot=(0, 0, 0), parent=None, segs=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=max(8, segs // 2), radius=1)
    mtx = Matrix.Translation(loc) @ Euler_to_matrix(rot) @ Matrix.Diagonal((*scale, 1))
    bmesh.ops.transform(bm, matrix=mtx, verts=bm.verts)
    return mesh_obj(name, bm, material, parent)

def Euler_to_matrix(rot):
    from mathutils import Euler
    return Euler(rot).to_matrix().to_4x4()

def box(name, loc, size, material, rot=(0, 0, 0), parent=None, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel / max(size), segments=2, affect='EDGES')
    mtx = Matrix.Translation(loc) @ Euler_to_matrix(rot) @ Matrix.Diagonal((*size, 1))
    bmesh.ops.transform(bm, matrix=mtx, verts=bm.verts)
    return mesh_obj(name, bm, material, parent, smooth_on=bool(bevel))

_profiles = {}
def profile_curve(kind, w, t):
    key = (kind, w, t)
    if key in _profiles:
        return _profiles[key]
    cu = bpy.data.curves.new(f'profile_{kind}_{w}_{t}', 'CURVE')
    cu.resolution_u = 2
    sp = cu.splines.new('NURBS')
    pts = []
    n = 8
    for i in range(n):
        a = 2 * math.pi * i / n
        if kind == 'flat':      # lens-shaped strand cross-section
            pts.append((w * math.cos(a), t * math.sin(a) * (0.6 + 0.4 * abs(math.cos(a)))))
        else:
            pts.append((w * math.cos(a), w * math.sin(a)))
    sp.points.add(len(pts) - 1)
    for p, (x, y) in zip(sp.points, pts):
        p.co = (x, y, 0, 1)
    sp.use_cyclic_u = True
    sp.order_u = 3
    ob = bpy.data.objects.new(cu.name, cu)
    col.objects.link(ob)
    ob.hide_render = True
    ob.hide_viewport = True
    _profiles[key] = ob
    return ob

def strand(name, pts, material, width=0.012, thick=0.004, kind='flat', parent=None, tilt=0.0, res=6):
    """pts: [(x, y, z, radius_scale)] -> tapered swept mesh."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.resolution_u = res
    cu.bevel_mode = 'OBJECT'
    cu.bevel_object = profile_curve(kind, width, thick)
    cu.use_fill_caps = True
    cu.twist_mode = 'MINIMUM'
    sp = cu.splines.new('NURBS')
    sp.points.add(len(pts) - 1)
    for p, (x, y, z, r) in zip(sp.points, pts):
        p.co = (x, y, z, 1)
        p.radius = r
        p.tilt = tilt
    sp.order_u = min(4, len(pts))
    sp.use_endpoint_u = True
    ob = bpy.data.objects.new(name, cu)
    link(ob)
    apply_all(ob)
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)     # swept meshes can come out inside-out
    bm.to_mesh(ob.data); bm.free()
    ob.data.materials.clear()
    ob.data.materials.append(material)
    smooth(ob)
    if parent:
        ob.parent = parent
        ob.matrix_parent_inverse = parent.matrix_world.inverted()
    return ob

def bvh_of(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.transform(obj.matrix_world)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    return tree

def front_y(tree, x, z, default=-0.08):
    hit = tree.ray_cast(Vector((x, -2.0, z)), Vector((0, 1, 0)))
    return hit[0].y if hit[0] else default

