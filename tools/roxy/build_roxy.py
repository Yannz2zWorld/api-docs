# Roxy Migurdia (Mushoku Tensei) - stylised full-body anime model built procedurally in Blender.
# Character faces -Y (glTF export turns that into +Z, toward a three.js camera). Units: metres.
# Usage: python build_roxy.py <face.png> <out.glb> [preview_dir]
import sys, math, os
import bpy, bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

FACE_PNG, OUT_GLB = sys.argv[1], sys.argv[2]
PREVIEW = sys.argv[3] if len(sys.argv) > 3 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection

# ------------------------------------------------------------------ materials
def mat(name, rgb, rough=0.65, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*srgb(rgb), 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emit:
        p.inputs['Emission Color'].default_value = (*srgb(emit), 1)
        p.inputs['Emission Strength'].default_value = strength
    return m

def srgb(hexstr):
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]

M = {
    'skin': mat('Skin', '#f6dccd', 0.55),
    'hair': mat('Hair', '#5767c4', 0.45),
    'hair_dark': mat('HairShade', '#3f4ca3', 0.5),
    'hat': mat('HatBlack', '#25232a', 0.7),
    'band_tan': mat('HatBandTan', '#b48a52', 0.6),
    'band_white': mat('HatBandWhite', '#ecebe6', 0.6),
    'coat': mat('CoatWhite', '#ece8df', 0.7),
    'trim': mat('TrimDark', '#2d2c35', 0.6),
    'vest': mat('VestDark', '#43424d', 0.6),
    'strap': mat('StrapWhite', '#f1efe9', 0.6),
    'belt': mat('BeltTan', '#a8844f', 0.5),
    'skirt': mat('SkirtBlack', '#1f1e26', 0.7),
    'shirt': mat('ShirtWhite', '#f7f6f3', 0.7),
    'ribbon': mat('RibbonBlack', '#18171d', 0.5),
    'sock': mat('SockBlack', '#1d1c22', 0.75),
    'boot': mat('BootWhite', '#dcdbe0', 0.45),
    'sole': mat('BootSole', '#3a3640', 0.6),
    'bone': mat('StaffBone', '#efe7d6', 0.5),
    'iron': mat('StaffIron', '#2a2a31', 0.35, metal=0.6),
    'crystal': mat('Crystal', '#5fb2ff', 0.1, emit='#4aa3ff', strength=2.5),
    'diamond': mat('SkirtDiamond', '#f2f1ee', 0.6),
}

# face decal: image texture with alpha
face_m = bpy.data.materials.new('Face')
face_m.use_nodes = True
nt = face_m.node_tree
pr = nt.nodes.get('Principled BSDF')
tex = nt.nodes.new('ShaderNodeTexImage')
tex.image = bpy.data.images.load(FACE_PNG)
tex.image.pack()
nt.links.new(tex.outputs['Color'], pr.inputs['Base Color'])
nt.links.new(tex.outputs['Alpha'], pr.inputs['Alpha'])
pr.inputs['Roughness'].default_value = 0.6
M['face'] = face_m

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

# ------------------------------------------------------------------ rig-ish hierarchy
root = empty('Roxy', (0, 0, 0))
HC = Vector((0, 0.004, 1.305))     # head centre
HR = 0.098                         # head radius
head_pivot = empty('Head', (0, 0, 1.215), root)
staff_pivot = empty('Staff', (-0.258, -0.04, 0.0), root)

# ------------------------------------------------------------------ body
# torso + neck (skin modifier); faces above the collar are skin, the rest is under clothes
torso = skin_body('Torso',
    [(0, 0.004, 0.83), (0, 0.006, 0.93), (0, 0.004, 1.04), (0, 0.006, 1.145), (0, 0.008, 1.20), (0, 0.008, 1.245),
     (0.128, 0.006, 1.152), (-0.128, 0.006, 1.152), (0.072, 0.004, 0.80), (-0.072, 0.004, 0.80)],
    [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (3, 6), (3, 7), (0, 8), (0, 9)],
    [(0.105, 0.072), (0.074, 0.058), (0.092, 0.068), (0.08, 0.056), (0.031, 0.031), (0.03, 0.03),
     (0.044, 0.044), (0.044, 0.044), (0.07, 0.066), (0.07, 0.066)], M['vest'])
torso.name = 'Torso'
assign_by(torso, [(M['skin'], lambda c: c.z > 1.175), (M['vest'], lambda c: True)])
torso.parent = root
torso_tree = bvh_of(torso)

# bust hint under the vest
for s in (1, -1):
    ellipsoid(f'Bust{s}', (s * 0.04, -0.036, 1.04), (0.036, 0.026, 0.032), M['vest'], parent=root)

def leg(side):
    s = side
    ob = skin_body(f'Leg{"L" if s > 0 else "R"}',
        [(s * 0.072, 0.004, 0.80), (s * 0.08, 0.0, 0.62), (s * 0.084, -0.004, 0.44), (s * 0.084, 0.006, 0.26), (s * 0.085, 0.012, 0.085), (s * 0.086, -0.02, 0.04), (s * 0.087, -0.075, 0.028)],
        [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6)],
        [(0.068, 0.066), (0.058, 0.056), (0.042, 0.044), (0.038, 0.041), (0.027, 0.03), (0.03, 0.028), (0.026, 0.02)], M['skin'])
    assign_by(ob, [(M['sock'], lambda c: c.z < 0.47), (M['skin'], lambda c: True)])
    ob.parent = root
    # boot shell from below the knee
    boot = skin_body(f'Boot{"L" if s > 0 else "R"}',
        [(s * 0.084, 0.004, 0.41), (s * 0.084, 0.006, 0.26), (s * 0.085, 0.012, 0.09), (s * 0.086, -0.02, 0.035), (s * 0.087, -0.085, 0.026)],
        [(0, 1), (1, 2), (2, 3), (3, 4)],
        [(0.05, 0.052), (0.047, 0.05), (0.036, 0.04), (0.04, 0.036), (0.033, 0.027)], M['boot'])
    assign_by(boot, [(M['sole'], lambda c: c.z < 0.016), (M['trim'], lambda c: 0.385 < c.z < 0.41), (M['boot'], lambda c: True)])
    boot.parent = root
    # boot cuff fold + laces line
    lathe(f'BootCuff{s}', [(0.056, 0.425), (0.058, 0.40), (0.054, 0.375)], M['boot'], 32, center=(s * 0.084, 0.004, 0), parent=root)
    btree = bvh_of(boot)
    for k in range(2):
        z = 0.30 - k * 0.09
        y = front_y(btree, s * 0.084, z, -0.05) + 0.004
        box(f'BootStrap{s}{k}', (s * 0.084, y, z), (0.07, 0.012, 0.007), M['trim'], parent=root)
for s in (1, -1):
    leg(s)

def arm(side):
    s = side
    # right arm (s=-1) hangs a little forward to grip the staff
    fwd = -0.03 if s < 0 else 0.0
    pts = [(s * 0.138, 0.006, 1.152), (s * 0.19, 0.012 + fwd * 0.5, 0.95), (s * 0.235, -0.004 + fwd, 0.765), (s * 0.248, -0.012 + fwd, 0.71), (s * 0.252, -0.02 + fwd, 0.665)]
    ob = skin_body(f'Arm{"L" if s > 0 else "R"}', pts, [(0, 1), (1, 2), (2, 3), (3, 4)],
        [(0.045, 0.045), (0.038, 0.039), (0.036, 0.036), (0.022, 0.015), (0.016, 0.011)], M['coat'], subdiv=2)
    assign_by(ob, [(M['skin'], lambda c: c.z < 0.745), (M['trim'], lambda c: c.z < 0.79), (M['coat'], lambda c: True)])
    ob.parent = root
    return ob
arms = [arm(1), arm(-1)]

# ------------------------------------------------------------------ clothes
# white jacket over the vest, open at the front
jacket = skin_body('Jacket',
    [(0, 0.006, 0.80), (0, 0.006, 0.93), (0, 0.006, 1.04), (0, 0.006, 1.145), (0.128, 0.006, 1.152), (-0.128, 0.006, 1.152)],
    [(0, 1), (1, 2), (2, 3), (3, 4), (3, 5)],
    [(0.125, 0.09), (0.088, 0.073), (0.106, 0.084), (0.092, 0.07), (0.052, 0.052), (0.052, 0.052)], M['coat'])
bm = bmesh.new(); bm.from_mesh(jacket.data)
kill = [f for f in bm.faces if f.calc_center_median().y < -0.02 and abs(f.calc_center_median().x) < 0.05 + (1.15 - f.calc_center_median().z) * 0.06 and f.calc_center_median().z < 1.13]
kill += [f for f in bm.faces if f.calc_center_median().z > 1.17 and abs(f.calc_center_median().x) < 0.06]
bmesh.ops.delete(bm, geom=kill, context='FACES')
bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=0.004)
bm.to_mesh(jacket.data); bm.free()
smooth(jacket)
jacket.parent = root
jacket_tree = bvh_of(jacket)
# dark trim along the front opening
for s in (1, -1):
    pts = []
    for k in range(9):
        z = 1.12 - k * 0.04
        x = s * (0.05 + (1.15 - z) * 0.06 + 0.004)
        pts.append((x, front_y(jacket_tree, x, z, -0.08) - 0.002, z, 1.0))
    strand(f'JacketTrim{s}', pts, M['trim'], width=0.006, thick=0.002, kind='flat', parent=root)
# jacket hem trim
lathe('JacketHem', [(0.127, 0.812), (0.128, 0.80)], M['trim'], 48, center=(0, 0.01, 0), parent=root,
      radial=lambda t, r, z: (r * (1.0 if math.sin(t) > -0.85 else 0.0001), 0))

# short shoulder capelet with dark edge (open at the front)
def capelet_radial(t, r, z):
    front = math.sin(t) < -0.93          # opening toward -Y
    ell = 1 - 0.32 * math.sin(t) ** 2    # shoulders are wider than deep
    return ((r * ell) if not front else r * 0.001, 0.0)
cape = lathe('Capelet', [(0.05, 1.222), (0.1, 1.205), (0.15, 1.165), (0.178, 1.11), (0.186, 1.07)], M['coat'], 64, center=(0, 0.012, 0), parent=root, radial=capelet_radial)
bm = bmesh.new(); bm.from_mesh(cape.data); bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=0.004); bm.to_mesh(cape.data); bm.free(); smooth(cape)
lathe('CapeletEdge', [(0.187, 1.076), (0.19, 1.062)], M['trim'], 64, center=(0, 0.012, 0), parent=root, radial=capelet_radial)

# shirt collar + black ribbon
lathe('Collar', [(0.036, 1.232), (0.039, 1.205), (0.045, 1.182)], M['shirt'], 32, center=(0, 0.004, 0), parent=root)
for s in (1, -1):
    ellipsoid(f'Bow{s}', (s * 0.016, -0.047, 1.178), (0.016, 0.006, 0.011), M['ribbon'], rot=(0, s * 0.35, 0), parent=root)
    strand(f'BowTail{s}', [(s * 0.004, -0.048, 1.172, 1), (s * 0.012, -0.056, 1.14, 0.9), (s * 0.018, -0.062, 1.11, 0.7)], M['ribbon'], width=0.006, thick=0.0015, parent=root)
ellipsoid('BowKnot', (0, -0.05, 1.177), (0.006, 0.006, 0.007), M['ribbon'], parent=root)

# vest details: crossing straps, belt with buckle loops
for s in (1, -1):
    pts = []
    for k in range(7):
        t = k / 6
        x = s * (-0.05 + 0.1 * t)
        z = 1.10 - 0.16 * t
        pts.append((x, front_y(torso_tree, x, z, -0.07) - 0.004, z, 1.0))
    strand(f'Strap{s}', pts, M['strap'], width=0.007, thick=0.0018, parent=root)
lathe('Belt', [(0.079, 0.915), (0.08, 0.895)], M['belt'], 48, center=(0, 0.006, 0), parent=root)
lathe('Belt2', [(0.083, 0.875), (0.084, 0.86)], M['belt'], 48, center=(0, 0.006, 0), parent=root)

# skirt: flared, soft pleats, scalloped hem, white diamonds
def skirt_radial(t, r, z):
    pleat = 1 + 0.035 * math.sin(14 * t) * min(1, (0.90 - z) / 0.2)
    dz = 0.0
    if z < 0.66:
        dz = 0.012 * abs(math.sin(10 * t))      # scallops
    return (r * pleat, dz)
skirt = lathe('Skirt', [(0.086, 0.90), (0.105, 0.86), (0.15, 0.77), (0.185, 0.69), (0.198, 0.655)], M['skirt'], 140,
              center=(0, 0.01, 0), parent=root, radial=skirt_radial)
bm = bmesh.new(); bm.from_mesh(skirt.data)
bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=0.004)
bm.to_mesh(skirt.data); bm.free(); smooth(skirt)
for k in range(10):
    t = 2 * math.pi * (k + 0.5) / 10
    r = 0.188 * (1 + 0.035 * math.sin(14 * t))
    loc = (r * math.cos(t) * 1.03, 0.01 + r * math.sin(t) * 1.03, 0.683)
    box(f'Diamond{k}', loc, (0.013, 0.003, 0.013), M['diamond'], rot=(0, math.radians(45), t + math.pi / 2), parent=root)

# ------------------------------------------------------------------ head
def head_mesh():
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=HR)
    for v in bm.verts:
        x, y, z = v.co
        if z < 0:                             # anime jaw: narrow, pointed chin
            t = -z / HR
            v.co.x *= 1 - 0.32 * t ** 1.4
            v.co.y *= 1 - 0.18 * t
            v.co.y -= 0.012 * t ** 2
            v.co.z *= 1.06
        v.co.y *= 0.96
        v.co += HC
    return bm
head = mesh_obj('HeadMesh', head_mesh(), M['skin'], head_pivot)
head_tree = bvh_of(head)

# face decal shell: front of the head, UV = front orthographic projection (matches face_texture.py)
def face_shell():
    bm = head_mesh()
    kill = [f for f in bm.faces if f.calc_center_median().y > HC.y - 0.035]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    for v in bm.verts:
        n = (v.co - HC).normalized()
        v.co += n * 0.0012
    uv = bm.loops.layers.uv.new('UVMap')
    R = 0.115
    for f in bm.faces:
        for l in f.loops:
            x, z = l.vert.co.x - HC.x, l.vert.co.z - HC.z
            l[uv].uv = (0.5 + x / (2 * R), 0.5 + z / (2 * R))
    return bm
face = mesh_obj('Face', face_shell(), M['face'], head_pivot)

# ears (mostly hidden by hair)
for s in (1, -1):
    ellipsoid(f'Ear{s}', (s * (HR * 0.93), HC.y + 0.01, HC.z - 0.012), (0.012, 0.02, 0.026), M['skin'], parent=head_pivot)

# ------------------------------------------------------------------ hair
def hair_cap():
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=HR * 1.09)
    for v in bm.verts:
        v.co.y *= 0.98
        v.co += HC + Vector((0, 0.008, 0.012))
    kill = []
    for f in bm.faces:
        c = f.calc_center_median() - HC
        if c.z < -0.105:                                   # below the nape
            kill.append(f)
        elif c.y < -0.025 and c.z < 0.045:                 # face opening
            kill.append(f)
        elif c.y < 0.0 and c.z < -0.03 and abs(c.x) < 0.085:
            kill.append(f)
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=0.006)
    return bm
mesh_obj('HairCap', hair_cap(), M['hair'], head_pivot)

H = lambda x, y, z: (HC.x + x, HC.y + y, HC.z + z)
# bangs: flat tapered strands over the forehead, one longer between the eyes
for i, x in enumerate([-0.075, -0.056, -0.036, -0.017, 0.0, 0.018, 0.038, 0.058, 0.077]):
    tip = 0.0 if abs(x) < 0.01 else 0.018 + 0.25 * x * x / 0.01 * 0.01
    sway = 0.006 * math.sin(i * 1.7)
    strand(f'Bang{i}', [
        (*H(x * 0.55, -0.02, 0.108), 1.0),
        (*H(x * 0.95, -0.085, 0.085), 1.0),
        (*H(x * 1.08 + sway, -HR - 0.012, 0.045), 0.85),
        (*H(x * 1.1 + sway * 1.5, -HR - 0.012, tip + 0.002), 0.05)],
        M['hair'], width=0.017, thick=0.0045, parent=head_pivot)
# side locks framing the face, down to the chest
for s in (1, -1):
    for j, off in enumerate((0.0, 0.016)):
        strand(f'SideLock{s}{j}', [
            (*H(s * (0.07 + off), -0.06, 0.07), 1.0),
            (*H(s * (0.094 + off), -0.07 + off, 0.0), 1.0),
            (*H(s * (0.098 + off * 1.3), -0.06 + off, -0.09), 0.9),
            (*H(s * (0.104 + off), -0.05 + off, -0.17), 0.6),
            (*H(s * (0.11 + off), -0.045 + off, -0.215), 0.05)],
            M['hair'], width=0.016, thick=0.004, parent=head_pivot)
# back hair: layered strands to mid-back
for i in range(11):
    a = (i / 10 - 0.5) * 2.2                   # spread across the back of the head
    x = math.sin(a) * 0.1
    yb = math.cos(a) * 0.1
    length = 0.33 + 0.05 * math.cos(i * 1.3)
    strand(f'BackHair{i}', [
        (*H(x * 0.6, yb * 0.4, 0.1), 1.0),
        (*H(x * 1.05, yb + 0.012, 0.02), 1.0),
        (*H(x * 1.15, yb + 0.03, -0.12), 0.95),
        (*H(x * 1.25, yb + 0.045, -0.12 - length * 0.6), 0.7),
        (*H(x * 1.3, yb + 0.05, -0.12 - length), 0.05)],
        M['hair'] if i % 3 else M['hair_dark'], width=0.03, thick=0.006, parent=head_pivot)

# braids: lobed chains from behind the ears to the thighs, black ribbon, tufted end
def braid(s):
    path = [Vector(H(s * 0.088, 0.03, -0.055)), Vector((s * 0.135, 0.06, 1.13)), Vector((s * 0.165, 0.055, 0.95)),
            Vector((s * 0.178, 0.045, 0.78)), Vector((s * 0.183, 0.04, 0.64))]
    def at(t):
        n = len(path) - 1
        i = min(int(t * n), n - 1)
        u = t * n - i
        p0, p1 = path[max(i - 1, 0)], path[i]
        p2, p3 = path[i + 1], path[min(i + 2, n)]
        return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)
    lobes = 22
    for k in range(lobes):
        t = k / (lobes - 1)
        p = at(t)
        tan = (at(min(1, t + 0.01)) - at(max(0, t - 0.01))).normalized()
        r = 0.026 * (1 - 0.35 * t)
        q = tan.to_track_quat('Z', 'Y')
        twist = Matrix.Rotation(math.radians(30 if k % 2 else -30), 4, 'Y')
        rot = (q.to_matrix().to_4x4() @ twist).to_euler()
        ellipsoid(f'Braid{s}_{k}', p, (r * 0.95, r * 0.72, r * 1.35), M['hair'] if k % 2 else M['hair_dark'], rot=tuple(rot), parent=head_pivot, segs=16)
    end = at(1.0)
    # ribbon bow
    for b in (1, -1):
        ellipsoid(f'BraidBow{s}{b}', end + Vector((b * 0.02, -0.004, -0.012)), (0.02, 0.006, 0.011), M['ribbon'], rot=(0, b * 0.5, 0), parent=head_pivot)
        strand(f'BraidRibbonTail{s}{b}', [(*(end + Vector((b * 0.004, -0.006, -0.016))), 1), (*(end + Vector((b * 0.016, -0.01, -0.06))), 0.8), (*(end + Vector((b * 0.022, -0.012, -0.095))), 0.5)],
               M['ribbon'], width=0.007, thick=0.0015, parent=head_pivot)
    ellipsoid(f'BraidKnot{s}', end + Vector((0, -0.006, -0.012)), (0.008, 0.007, 0.009), M['ribbon'], parent=head_pivot)
    # tuft below the ribbon
    for j in range(5):
        a = (j - 2) * 0.35
        strand(f'BraidTuft{s}{j}', [(*(end + Vector((0, 0, -0.02))), 1), (*(end + Vector((math.sin(a) * 0.02, 0.004 * j, -0.06))), 0.8), (*(end + Vector((math.sin(a) * 0.035, 0.006 * j, -0.11))), 0.05)],
               M['hair'], width=0.011, thick=0.004, parent=head_pivot)
for s in (1, -1):
    braid(s)

# ------------------------------------------------------------------ hat
hat_pivot = empty('Hat', (HC.x, HC.y + 0.012, HC.z + 0.07), head_pivot)
hat_pivot.rotation_euler = (math.radians(-9), math.radians(4), 0)
def brim_radial(t, r, z):
    droop = -0.03 * (r / 0.31) ** 2 * (1 + 0.35 * math.sin(t))   # wavy, drooping edge
    return (r * (1 + 0.025 * math.sin(3 * t)), droop)
brim = lathe('HatBrim', [(0.118, 0.008), (0.2, 0.005), (0.31, 0.0), (0.312, -0.009), (0.2, -0.004), (0.118, -0.002)],
             M['hat'], 72, parent=hat_pivot, radial=brim_radial)
for ob in (brim,):
    ob.location = (0, 0, 0)
def cone_mesh():
    bm = bmesh.new()
    steps, segs = 28, 40
    rings = []
    for i in range(steps + 1):
        t = i / steps
        r = 0.122 * (1 - t) ** 1.08 + 0.003
        z = 0.30 * t
        bend_y = 0.13 * t ** 2.4       # tip folds backwards
        bend_z = -0.05 * t ** 3
        ring = []
        for k in range(segs):
            a = 2 * math.pi * k / segs
            ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a) + bend_y, z + bend_z + 0.004 * math.sin(2 * a) * t)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for k in range(segs):
            j = (k + 1) % segs
            bm.faces.new((a[k], a[j], b[j], b[k]))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm
cone = mesh_obj('HatCone', cone_mesh(), M['hat'], hat_pivot)
lathe('HatBandTan', [(0.1235, 0.042), (0.1255, 0.012)], M['band_tan'], 48, parent=hat_pivot)
lathe('HatBandWhite', [(0.117, 0.058), (0.1205, 0.042)], M['band_white'], 48, parent=hat_pivot)
# parent-relative placement for hat parts (built in hat space)
for ob in list(hat_pivot.children):
    ob.matrix_parent_inverse = Matrix.Identity(4)

# ------------------------------------------------------------------ staff
def staff_parts():
    p = staff_pivot
    def place(ob):
        ob.matrix_parent_inverse = Matrix.Identity(4)
        return ob
    place(lathe('StaffShaft', [(0.011, 1.43), (0.012, 0.7), (0.012, 0.03), (0.008, 0.0)], M['bone'], 20, parent=p, cap=True))
    place(lathe('StaffGrip', [(0.0135, 0.80), (0.0135, 0.66)], M['iron'], 20, parent=p))
    place(lathe('StaffCollar', [(0.016, 1.44), (0.02, 1.425), (0.016, 1.41)], M['iron'], 24, parent=p))
    # iron lantern cage
    place(lathe('StaffCage', [(0.006, 1.56), (0.026, 1.535), (0.031, 1.49), (0.024, 1.45), (0.014, 1.44)], M['iron'], 8, parent=p, smooth_on=False))
    for k in range(6):
        a = 2 * math.pi * k / 6
        place(strand(f'StaffRib{k}', [(0.033 * math.cos(a), 0.033 * math.sin(a), 1.455, 1), (0.036 * math.cos(a), 0.036 * math.sin(a), 1.495, 1), (0.03 * math.cos(a), 0.03 * math.sin(a), 1.535, 1)],
                     M['iron'], width=0.003, thick=0.003, kind='round', parent=p))
    # bone crook rising and curling outward, holding the crystal
    place(strand('StaffBoneTop', [(0, 0, 1.55, 1.0), (0.0, 0.0, 1.62, 1.0), (-0.012, 0.0, 1.68, 0.95), (-0.05, 0.0, 1.705, 0.9), (-0.085, 0.0, 1.69, 0.85), (-0.095, 0.0, 1.655, 0.8)],
                 M['bone'], width=0.016, thick=0.016, kind='round', parent=p))
    place(ellipsoid('StaffBoneKnob', (0.0, 0.0, 1.70), (0.026, 0.02, 0.03), M['bone'], parent=p))
    place(lathe('StaffCup', [(0.012, 1.655), (0.024, 1.64), (0.02, 1.625)], M['bone'], 16, center=(-0.095, 0, 0), parent=p))
    # crystal: elongated octahedron + falling drop
    bm = bmesh.new()
    pts = [(0, 0, 0.03), (0, 0, -0.045)] + [(0.015 * math.cos(a), 0.015 * math.sin(a), 0) for a in [k * math.pi / 3 for k in range(6)]]
    vs = [bm.verts.new(v) for v in pts]
    for k in range(6):
        a, b = vs[2 + k], vs[2 + (k + 1) % 6]
        bm.faces.new((vs[0], a, b)); bm.faces.new((vs[1], b, a))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.translate(bm, vec=(-0.095, 0, 1.585), verts=bm.verts)
    place(mesh_obj('Crystal', bm, M['crystal'], p, smooth_on=False))
    place(ellipsoid('CrystalDrop', (-0.095, 0, 1.515), (0.006, 0.006, 0.009), M['crystal'], parent=p))
staff_parts()
staff_pivot.rotation_euler = (math.radians(2), math.radians(1.5), 0)

# left hand rests near the skirt; small fist over the staff for the right hand
ellipsoid('FistR', (-0.258, -0.04, 0.705), (0.021, 0.022, 0.03), M['skin'], parent=root)

# ------------------------------------------------------------------ clean up + export
for o in list(col.objects):
    if o.type == 'CURVE':
        bpy.data.objects.remove(o)
for o in col.objects:
    if o.type == 'MESH':
        o.data.validate()
groups = {}
for o in col.objects:
    if o.type != 'MESH': continue
    key = ''.join(ch for ch in o.name if not ch.isdigit()).split('_')[0].rstrip('-.')
    groups[key] = groups.get(key, 0) + len(o.data.vertices)
print('total verts', sum(groups.values()))
for k, v in sorted(groups.items(), key=lambda x: -x[1])[:14]: print(f'{v:8d} {k}')

bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB', export_apply=True, export_yup=True,
                          export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='AUTO',
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                          export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12)
print('exported', OUT_GLB, os.path.getsize(OUT_GLB) // 1024, 'KB')

# ------------------------------------------------------------------ preview renders (Cycles CPU)
if PREVIEW:
    world = bpy.data.worlds.new('W'); scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.55, 0.58, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    sun.data.energy = 3.2
    sun.rotation_euler = (math.radians(50), math.radians(-20), math.radians(-30))
    col.objects.link(sun)
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    cam.data.type = 'ORTHO'
    col.objects.link(cam)
    scene.camera = cam
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = False
    scene.render.film_transparent = False
    views = {'front': (0, -3, 0.95, 1.9), 'three_quarter': (-30, -3, 0.95, 1.9), 'side': (-90, -3, 0.95, 1.9), 'face': (-12, -3, 1.30, 0.42), 'back': (180, -3, 0.95, 1.9)}
    import sys as _s
    which = os.environ.get('VIEWS', 'front,three_quarter,face').split(',')
    for name in which:
        yaw, dist, z, scale = views[name]
        a = math.radians(yaw)
        cam.location = (3 * math.sin(a), -3 * math.cos(a), z)
        cam.rotation_euler = (Vector((0, 0, z)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.data.ortho_scale = scale
        res = (520, 780) if name != 'face' else (520, 520)
        scene.render.resolution_x, scene.render.resolution_y = res
        scene.render.filepath = os.path.join(PREVIEW, f'{name}.png')
        bpy.ops.render.render(write_still=True)
        print('rendered', name)
