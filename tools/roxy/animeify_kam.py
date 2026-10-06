# Adapt "Roxy Migurdia from Mushoku Tensei" by kam (Sketchfab, CC BY-SA 4.0) for the web:
#  - realistic eyes/eyelashes/mouth interior removed, face holes filled, nose/lips/cheeks
#    smoothed toward a flat anime face, anime face decal aligned to the original eye line
#  - realistic skin textures replaced by flat anime skin, hair recoloured to Roxy blue
#  - geometry decimated, textures resized, exported as Draco + WebP GLB
# The output is a derivative work and stays under CC BY-SA 4.0 (credit: kam).
# Usage: python animeify_kam.py <in.glb> <face.png> <out.glb> [preview_dir]
import sys, os, math
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix

SRC, FACE_PNG, OUT, PREVIEW = sys.argv[1], sys.argv[2], sys.argv[3], (sys.argv[4] if len(sys.argv) > 4 else None)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
sc = bpy.context.scene

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]

meshes = [o for o in sc.objects if o.type == 'MESH']
def by_mat(prefix):
    return [o for o in meshes if any(m and m.name.startswith(prefix) for m in o.data.materials)]

# ------------------------------------------------------------------ 1. remove realistic eye/mouth parts
eye_objs = by_mat('Sclera') + by_mat('Irises') + by_mat('Pupils')
def centre(objs):
    pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    return sum(pts, Vector()) / len(pts)
irises = by_mat('Irises')
eyes = sorted([centre([o]) for o in irises], key=lambda p: p.x)
EYE_L, EYE_R = eyes[0], eyes[1]                  # viewer's left (character right), viewer's right
print('eyes', EYE_L, EYE_R)
for o in eye_objs + by_mat('Eyelashes') + by_mat('1006'):
    bpy.data.objects.remove(o, do_unlink=True)
meshes = [o for o in sc.objects if o.type == 'MESH']

# face frame aligned with the eye line (head is rolled a little)
U = Vector((EYE_R.x - EYE_L.x, 0, EYE_R.z - EYE_L.z)).normalized()     # across the face
V = Vector((-U.z, 0, U.x))                                              # up the face
MID = (EYE_L + EYE_R) / 2
EYE_HALF = (EYE_R - EYE_L).length / 2
# my face texture: eyes at x=+-0.034, z=-0.004 around its centre, canvas half-size R=0.115
EYE_SCALE, EYE_DROP = 1.18, 0.004                                      # anime eyes: a bit bigger and lower than kam's
K = EYE_HALF / 0.034 * EYE_SCALE
R = 0.115 * K
ORIGIN = MID + V * (0.004 * K) - V * EYE_DROP                           # texture centre on the face

head = [o for o in by_mat('1001')][0]
print('head', head.name, len(head.data.vertices))

# ------------------------------------------------------------------ 2. fill face holes + soften features
mw = head.matrix_world.copy(); mwi = mw.inverted()
bm = bmesh.new(); bm.from_mesh(head.data)
def world(v): return mw @ v.co
boundary = [e for e in bm.edges if e.is_boundary]
front_boundary = [e for e in boundary if (lambda c: c.y < MID.y + 0.03 and abs(c.z - MID.z) < 0.09)(mw @ ((e.verts[0].co + e.verts[1].co) / 2))]
if front_boundary:
    res = bmesh.ops.holes_fill(bm, edges=front_boundary, sides=0)
    print('filled holes:', len(res['faces']))
    bmesh.ops.triangulate(bm, faces=res['faces'])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
# weighted Laplacian smoothing of the whole front of the face: full strength around the eyes,
# nose and mouth, fading to zero toward the jaw line / sides so the silhouette is kept
weight = {}
for v in bm.verts:
    p = mw @ v.co
    rel = p - ORIGIN
    if p.y > MID.y + 0.04: continue
    ex = rel.dot(U) / (EYE_HALF * 2.3)
    ez = (rel.dot(V) + EYE_HALF * 0.9) / (EYE_HALF * (2.3 if rel.dot(V) < -EYE_HALF * 0.9 else 2.6))
    r = math.sqrt(ex * ex + ez * ez)
    if r < 1:
        t = min(1, (1 - r) / 0.45)
        weight[v] = t * t * (3 - 2 * t)
print('front verts', len(weight))
for it in range(160):
    new = {}
    for v, wgt in weight.items():
        nb = [e.other_vert(v).co for e in v.link_edges]
        if not nb: continue
        avg = sum(nb, Vector()) / len(nb)
        new[v] = v.co.lerp(avg, 0.6 * wgt)
    for v, co in new.items():
        v.co = co
bm.normal_update()
bm.to_mesh(head.data); bm.free()
head.data.update()

# ------------------------------------------------------------------ 3. anime face decal on the smoothed face
fm = bpy.data.materials.new('Face'); fm.use_nodes = True
pr = fm.node_tree.nodes.get('Principled BSDF')
tx = fm.node_tree.nodes.new('ShaderNodeTexImage'); tx.image = bpy.data.images.load(FACE_PNG); tx.image.pack()
fm.node_tree.links.new(tx.outputs['Color'], pr.inputs['Base Color']); fm.node_tree.links.new(tx.outputs['Alpha'], pr.inputs['Alpha'])
pr.inputs['Roughness'].default_value = 0.6
# fold-free decal: a regular grid in face space, ray-cast from the front onto the smoothed head,
# so UVs are exactly the grid coordinates (no mirrored/folded triangles around the old lips)
from mathutils.bvhtree import BVHTree
hb = bmesh.new(); hb.from_mesh(head.data); hb.transform(mw); hb.normal_update()
bvh = BVHTree.FromBMesh(hb)
G = 96
bm = bmesh.new()
uv = bm.loops.layers.uv.new('UVMap')
grid = {}
for i in range(G + 1):
    for j in range(G + 1):
        a_, b_ = (i / G - 0.5) * 2 * R, (j / G - 0.5) * 2 * R
        start = ORIGIN + U * a_ + V * b_
        start.y = MID.y - 0.3
        hit, nrm, _, _ = bvh.ray_cast(start, Vector((0, 1, 0)), 0.5)
        if hit is not None and nrm.y < -0.1:
            grid[i, j] = (bm.verts.new(hit + nrm * 0.0012), (i / G, j / G))
hb.free()
for i in range(G):
    for j in range(G):
        quad = [grid.get(k) for k in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))]
        if all(quad) and max((q[0].co - quad[0][0].co).length for q in quad) < 4 * R / G:
            f = bm.faces.new([q[0] for q in quad])
            for l, q in zip(f.loops, quad):
                l[uv].uv = q[1]
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
for f in bm.faces:
    if f.normal.y > 0: f.normal_flip()
me = bpy.data.meshes.new('Face'); bm.to_mesh(me); bm.free()
face = bpy.data.objects.new('Face', me); sc.collection.objects.link(face)
me.materials.append(fm)
me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
print('face decal faces', len(me.polygons))

# ------------------------------------------------------------------ 4. anime skin + Roxy hair colour
def set_flat(mat, hexcol, rough=0.55):
    nt = mat.node_tree
    p = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    for inp in ('Base Color', 'Normal', 'Roughness', 'Metallic', 'Specular Tint'):
        if inp in p.inputs:
            for l in list(p.inputs[inp].links):
                nt.links.remove(l)
    p.inputs['Base Color'].default_value = (*srgb(hexcol), 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = 0.0
for name in ('1001', '1002', '1003', '1004', '1005'):
    m = bpy.data.materials.get(name)
    if m:
        set_flat(m, '#f3cdb9'); m.name = 'Skin' + name

hair_imgs = set()
for m in bpy.data.materials:
    if m.name.startswith('HairMat'):
        nt = m.node_tree
        p = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        texn = next((n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image), None)
        if texn:
            for l in list(p.inputs['Base Color'].links):
                nt.links.remove(l)
            nt.links.new(texn.outputs['Color'], p.inputs['Base Color'])   # bypass the dark tint Mix
            hair_imgs.add(texn.image)
        for inp in ('Normal', 'Roughness', 'Metallic'):
            for l in list(p.inputs[inp].links):
                nt.links.remove(l)
        p.inputs['Roughness'].default_value = 0.35
        if not p.inputs['Base Color'].links:
            p.inputs['Base Color'].default_value = (*srgb('#6f86dc'), 1)
        m.name = 'Hair' + m.name[len('HairMat'):]
for img in hair_imgs:
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    lum = 0.2126 * px[..., 0] + 0.7152 * px[..., 1] + 0.0722 * px[..., 2]
    lo, hi = np.percentile(lum, 5), np.percentile(lum, 99)
    t = np.clip((lum - lo) / max(1e-4, hi - lo), 0, 1)
    shade = 0.74 + 0.26 * t                        # keep strand variation, never near-black
    base = np.array([0x86 / 255, 0x97 / 255, 0xdc / 255], dtype=np.float32)
    hi_col = np.array([0xc4 / 255, 0xcd / 255, 0xf6 / 255], dtype=np.float32)
    rgb = base[None, None, :] * shade[..., None] + hi_col[None, None, :] * (t[..., None] ** 6) * 0.35
    px[..., :3] = np.clip(rgb, 0, 1)
    img.pixels[:] = px.ravel()
    img.pack()
    print('recoloured hair texture', img.name, w, h)

# drop heavy maps the web material does not use
for m in bpy.data.materials:
    if not m.node_tree: continue
    nt = m.node_tree
    p = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not p: continue
    for inp in ('Normal', 'Roughness', 'Metallic'):
        if inp in p.inputs:
            for l in list(p.inputs[inp].links):
                nt.links.remove(l)

# ------------------------------------------------------------------ 5. decimate + shrink textures
meshes = [o for o in sc.objects if o.type == 'MESH']
def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)
total = sum(tris(o) for o in meshes)
for o in meshes:
    if o.name == 'Face' or o == head: continue
    n = tris(o)
    names = ','.join(m.name for m in o.data.materials if m)
    if n < 600 or names.startswith('Hair'): continue
    ratio = 0.45 if n > 8000 else 0.6
    if n > 15000: ratio = 0.18 if 'Material.001' in names else 0.35
    mod = o.modifiers.new('dec', 'DECIMATE'); mod.ratio = ratio
    bpy.context.view_layer.objects.active = o
    for x in sc.objects: x.select_set(False)
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier='dec')
after = sum(tris(o) for o in sc.objects if o.type == 'MESH')
print('triangles', total, '->', after)
TEXDIR = os.path.join(os.path.dirname(OUT), 'tex'); os.makedirs(TEXDIR, exist_ok=True)
used = {n.image for m in bpy.data.materials if m.node_tree for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image}
for i, img in enumerate(used):
    if img == tx.image: continue
    w, h = img.size
    if max(w, h) > 1024:
        img.scale(1024, 1024)
    path = os.path.join(TEXDIR, f'tex{i}.png')
    img.filepath_raw = path; img.file_format = 'PNG'
    img.save()
    from PIL import Image as PImage                 # grayscale PNGs break Blender's WebP writer
    pi = PImage.open(path); pi.convert('RGBA' if pi.mode in ('LA', 'RGBA', 'PA') or 'transparency' in pi.info else 'RGB').save(path)
    if img.packed_file: img.unpack(method='REMOVE')
    img.filepath = path; img.reload()

# ------------------------------------------------------------------ 6. export
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True,
                          export_copyright='Roxy Migurdia by kam (https://sketchfab.com/menhankam), CC BY-SA 4.0; modified by Yannz API (anime face, hair colour, web optimisation), CC BY-SA 4.0',
                          export_image_format='WEBP', export_image_quality=82,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                          export_draco_position_quantization=14, export_draco_normal_quantization=10,
                          export_draco_texcoord_quantization=12)
print('exported', OUT, os.path.getsize(OUT) // 1024, 'KB')

if PREVIEW:
    world = bpy.data.worlds.new('W'); sc.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.25, 0.27, 0.36, 1)
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN')); sun.data.energy = 3; sun.rotation_euler = (math.radians(55), 0, math.radians(-25)); sc.collection.objects.link(sun)
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); cam.data.type = 'ORTHO'; sc.collection.objects.link(cam); sc.camera = cam
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.cycles.use_denoising = True
    for name, target, scale, yaw, res in (('full', Vector((0.2, 0, 0.98)), 2.1, 0, (480, 800)), ('face', MID + Vector((0, 0, -0.02)), 0.26, 0, (600, 600)), ('face34', MID + Vector((0, 0, -0.02)), 0.3, -30, (600, 600))):
        a = math.radians(yaw); d = 4
        cam.location = target + Vector((d * math.sin(a), -d * math.cos(a), 0.0))
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.data.ortho_scale = scale
        sc.render.resolution_x, sc.render.resolution_y = res
        sc.render.filepath = os.path.join(PREVIEW, f'anime_{name}.png')
        bpy.ops.render.render(write_still=True)
        print('rendered', name)
