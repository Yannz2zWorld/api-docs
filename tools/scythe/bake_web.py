# Bake the Crimson Requiem scythe (exported from /3d with three's GLTFExporter) into a light web GLB:
# merge duplicate vertices, join meshes per material (few draw calls), decimate, Draco + WebP.
# Usage: python bake_web.py <raw.glb> <out.glb> [target_tris]
import sys, bpy, bmesh
SRC, OUT = sys.argv[1], sys.argv[2]
TARGET = int(sys.argv[3]) if len(sys.argv) > 3 else 60000
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
sc = bpy.context.scene
def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)
meshes = [o for o in sc.objects if o.type == 'MESH']
before = sum(tris(o) for o in meshes)
# bake transforms, merge duplicates
for o in meshes:
    mw = o.matrix_world.copy()
    if o.data.users > 1: o.data = o.data.copy()
    o.parent = None; o.data.transform(mw); o.matrix_world.identity()
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(o.data); bm.free()
for o in [o for o in sc.objects if o.type != 'MESH']:
    bpy.data.objects.remove(o, do_unlink=True)
# join per material
groups = {}
for o in [o for o in sc.objects if o.type == 'MESH']:
    key = o.data.materials[0].name if o.data.materials else 'none'
    if o.name.startswith('GLOW_'): key = 'glow'
    groups.setdefault(key, []).append(o)
for key, objs in groups.items():
    for x in sc.objects: x.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = o.data.name = 'Scythe_' + key
meshes = [o for o in sc.objects if o.type == 'MESH']
total = sum(tris(o) for o in meshes)
ratio = min(1.0, TARGET / max(1, total - sum(tris(o) for o in meshes if o.name == 'Scythe_glow')))
for o in meshes:
    if o.name == 'Scythe_glow' or tris(o) < 1500: continue
    m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = ratio; m.use_collapse_triangulate = True
    for x in sc.objects: x.select_set(False)
    o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='dec')
for o in sc.objects:
    if o.type == 'MESH':
        o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
after = sum(tris(o) for o in sc.objects if o.type == 'MESH')
print('triangles', before, '->', after, 'meshes', len([o for o in sc.objects if o.type == 'MESH']))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True,
                          export_image_format='WEBP', export_image_quality=82, export_vertex_color='ACTIVE',
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                          export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12)
import os; print('exported', os.path.getsize(OUT) // 1024, 'KB')
