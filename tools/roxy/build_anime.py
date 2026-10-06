# Roxy Migurdia - anime character model following the owner's turnaround reference:
# long tan coat with white trim and layered capelet, navy cuffs, navy dress with gold straps,
# short dark skirt, black socks, white knee boots, pointed Migurd ears, voluminous blue hair
# with ahoge and two long braids, A-pose. Built procedurally in Blender 5, exported as Draco GLB.
# Usage: python build_anime.py <face.png> <out.glb> [preview_dir]
import sys, os, math
import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from roxylib import *            # noqa
from mathutils import Vector, Matrix, Euler
from mathutils.noise import noise as pnoise
import bmesh

FACE_PNG, OUT_GLB = sys.argv[1], sys.argv[2]
PREVIEW = sys.argv[3] if len(sys.argv) > 3 else None

def pmat(name, hexcol, rough=0.5, metal=0.0, coat=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes.get('Principled BSDF')
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    p.inputs['Coat Weight'].default_value = coat
    if emit:
        p.inputs['Emission Color'].default_value = (*srgb(emit), 1)
        p.inputs['Emission Strength'].default_value = strength
    ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs[6].default_value = (*srgb(hexcol), 1)
    nt.links.new(ca.outputs['Color'], mix.inputs[7])
    nt.links.new(mix.outputs[2], p.inputs['Base Color'])
    return m

M = {
    'skin': pmat('Skin', '#fde6da', 0.5),
    'hair': pmat('Hair', '#7b8ff0', 0.35, coat=0.3),
    'coat': pmat('CoatTan', '#c8a27a', 0.6),
    'coat_in': pmat('CoatLining', '#e8dcc6', 0.65),
    'trim': pmat('TrimWhite', '#f4f1ea', 0.5),
    'cuff': pmat('CuffNavy', '#262a4a', 0.5),
    'dress': pmat('DressNavy', '#2b3058', 0.45),
    'gold': pmat('Gold', '#d9ad5e', 0.3, metal=1.0),
    'skirt': pmat('SkirtDark', '#1e2038', 0.5),
    'frill': pmat('SkirtFrill', '#3a3f6e', 0.55),
    'shirt': pmat('ShirtWhite', '#fbfaf7', 0.55),
    'ribbon': pmat('RibbonBlack', '#17161f', 0.35, coat=0.3),
    'sock': pmat('SockBlack', '#1b1b24', 0.6),
    'boot': pmat('BootWhite', '#ecebef', 0.3, coat=0.4),
    'boot_shade': pmat('BootGrey', '#b9b8c6', 0.4),
    'sole': pmat('BootSole', '#3a3442', 0.5),
    'base': pmat('BaseBlack', '#101018', 0.15, coat=1.0),
    'base_rim': pmat('BaseRim', '#8fa0ff', 0.25, metal=0.7),
}
fm = bpy.data.materials.new('Face'); fm.use_nodes = True
pr = fm.node_tree.nodes.get('Principled BSDF')
tx = fm.node_tree.nodes.new('ShaderNodeTexImage'); tx.image = bpy.data.images.load(FACE_PNG); tx.image.pack()
fm.node_tree.links.new(tx.outputs['Color'], pr.inputs['Base Color']); fm.node_tree.links.new(tx.outputs['Alpha'], pr.inputs['Alpha'])
M['face'] = fm

figure = empty('Figure', (0, 0, 0))
BASE_H = 0.04
root = empty('Roxy', (0, 0, 0), figure)
HC = Vector((0, 0.004, 1.305))
HR = 0.1
head_pivot = empty('Head', (0, 0, 1.215), root)

def solidify(obj, t):
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=t)
    bm.to_mesh(obj.data); bm.free(); smooth(obj)

def tube(name, pts, radius, material, parent=None, res=6):
    """round swept tube; pts = [(x, y, z, radius_scale)]"""
    return strand(name, pts, material, width=radius, thick=radius, kind='round', parent=parent or root, res=res)

def arc_shell(name, rings, material, center=(0, 0.0), segs=96, ell=0.78, parent=None, fold=0.0, fold_k=7):
    """Open-front garment shell. rings: [(z, r, gap)] top->bottom; gap = half-angle of the
    front opening (radians). Returns object + list of edge points for trims."""
    bm = bmesh.new()
    grid = []
    edges_l, edges_r = [], []
    for (z, r, gap) in rings:
        a0, a1 = -math.pi / 2 + gap, 3 * math.pi / 2 - gap
        row = []
        for k in range(segs + 1):
            a = a0 + (a1 - a0) * k / segs
            depth = (1 - min(1, (1.2 - z) / 0.8)) if fold else 0
            rr = r * (1 + fold * math.sin(fold_k * a) * (1 - depth))
            x = center[0] + rr * math.cos(a)
            y = center[1] + rr * math.sin(a) * ell
            row.append(bm.verts.new((x, y, z)))
        edges_r.append(row[0].co.copy()); edges_l.append(row[-1].co.copy())
        grid.append(row)
    for ra, rb in zip(grid, grid[1:]):
        for k in range(segs):
            bm.faces.new((ra[k], ra[k + 1], rb[k + 1], rb[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # make normals point outward from the axis
    for f in bm.faces:
        c = f.calc_center_median()
        if f.normal.dot(Vector((c.x - center[0], c.y - center[1], 0))) < 0:
            f.normal_flip()
    ob = mesh_obj(name, bm, material, parent or root)
    return ob, edges_l, edges_r

def trim_along(name, pts, material, w=0.009, t=0.003, push=0.0):
    return strand(name, [(*p, 1.0) for p in pts], material, width=w, thick=t, parent=root, res=4)

# ------------------------------------------------------------------ body (A-pose)
torso = skin_body('Torso',
    [(0, 0.004, 0.84), (0, 0.006, 0.94), (0, 0.004, 1.04), (0, 0.006, 1.145), (0, 0.008, 1.20), (0, 0.008, 1.245),
     (0.126, 0.006, 1.155), (-0.126, 0.006, 1.155), (0.07, 0.004, 0.81), (-0.07, 0.004, 0.81)],
    [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (3, 6), (3, 7), (0, 8), (0, 9)],
    [(0.1, 0.07), (0.07, 0.054), (0.09, 0.066), (0.078, 0.055), (0.03, 0.03), (0.029, 0.029),
     (0.043, 0.043), (0.043, 0.043), (0.068, 0.064), (0.068, 0.064)], M['dress'], subdiv=2)
assign_by(torso, [(M['skin'], lambda c: c.z > 1.178), (M['dress'], lambda c: True)])
torso.parent = root
torso_tree = bvh_of(torso)
for s in (1, -1):
    ellipsoid(f'Bust{s}', (s * 0.038, -0.034, 1.04), (0.034, 0.025, 0.03), M['dress'], parent=root, segs=32)

for s in (1, -1):
    leg = skin_body(f'Leg{s}',
        [(s * 0.07, 0.004, 0.81), (s * 0.078, 0.0, 0.62), (s * 0.082, -0.004, 0.44), (s * 0.083, 0.006, 0.26), (s * 0.084, 0.012, 0.085), (s * 0.085, -0.02, 0.04), (s * 0.086, -0.075, 0.028)],
        [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6)],
        [(0.066, 0.064), (0.056, 0.054), (0.041, 0.043), (0.037, 0.04), (0.026, 0.029), (0.029, 0.027), (0.025, 0.02)], M['skin'], subdiv=2)
    assign_by(leg, [(M['sock'], lambda c: c.z < 0.53), (M['skin'], lambda c: True)])
    leg.parent = root
    boot = skin_body(f'Boot{s}',
        [(s * 0.083, 0.004, 0.43), (s * 0.083, 0.007, 0.26), (s * 0.084, 0.012, 0.095), (s * 0.085, -0.02, 0.045), (s * 0.086, -0.09, 0.03)],
        [(0, 1), (1, 2), (2, 3), (3, 4)],
        [(0.052, 0.055), (0.047, 0.051), (0.035, 0.039), (0.04, 0.036), (0.032, 0.025)], M['boot'], subdiv=2)
    assign_by(boot, [(M['sole'], lambda c: c.z < 0.016), (M['boot_shade'], lambda c: c.y > 0.035 and c.z < 0.3), (M['boot'], lambda c: True)])
    boot.parent = root
    # folded cuff, heel, sole, front seam
    lathe(f'BootCuff{s}', [(0.058, 0.47), (0.064, 0.455), (0.062, 0.43), (0.057, 0.418)], M['boot'], 48, center=(s * 0.083, 0.004, 0), parent=root,
          radial=lambda t, r, z: (r * (1 + 0.05 * max(0, -math.sin(t))), -0.012 * max(0, -math.sin(t))))
    box(f'Heel{s}', (s * 0.085, 0.03, 0.022), (0.038, 0.034, 0.044), M['sole'], parent=root, bevel=0.006)
    box(f'Sole{s}', (s * 0.086, -0.04, 0.006), (0.068, 0.12, 0.012), M['sole'], parent=root, bevel=0.005)
    bt = bvh_of(boot)
    seam = [(s * 0.083, front_y(bt, s * 0.083, z, -0.05) - 0.0015, z) for z in [0.4 - 0.05 * k for k in range(7)]]
    trim_along(f'BootSeam{s}', seam, M['boot_shade'], w=0.003, t=0.0015)
    for k, z in enumerate((0.36, 0.27, 0.18)):
        ellipsoid(f'BootButton{s}{k}', (s * 0.083 + s * 0.035, front_y(bt, s * 0.083 + s * 0.035, z, -0.04) + 0.01, z), (0.005, 0.005, 0.005), M['gold'], parent=root, segs=12)

def arm(s):
    sh = Vector((s * 0.136, 0.006, 1.153))
    el = Vector((s * 0.235, -0.002, 0.985))
    wr = Vector((s * 0.318, -0.02, 0.84))
    hd = Vector((s * 0.335, -0.028, 0.80))
    ob = skin_body(f'Arm{s}', [tuple(sh), tuple(el), tuple(wr), tuple(hd)], [(0, 1), (1, 2), (2, 3)],
        [(0.043, 0.043), (0.034, 0.034), (0.024, 0.022), (0.02, 0.013)], M['skin'], subdiv=2)
    ob.parent = root
    # wide coat sleeve, navy cuff with white trim
    d = (wr - sh).normalized()
    sl = [sh + d * 0.0, sh.lerp(el, 0.5), el, el.lerp(wr, 0.55), wr - d * 0.035]
    tube(f'Sleeve{s}', [(*sl[0], 1.0), (*sl[1], 0.95), (*sl[2], 0.92), (*sl[3], 0.98), (*sl[4], 1.08)], 0.056, M['coat'], res=8)
    c0, c1 = wr - d * 0.04, wr + d * 0.008
    tube(f'Cuff{s}', [(*c0, 1.0), (*c1, 1.03)], 0.062, M['cuff'], res=4)
    tube(f'CuffTrim{s}', [(*(c0 - d * 0.004), 1.0), (*(c0 + d * 0.006), 1.0)], 0.066, M['trim'], res=2)
    # relaxed hand with fingers
    palm = hd + d * 0.012
    ellipsoid(f'Palm{s}', palm, (0.016, 0.02, 0.024), M['skin'], rot=(0, s * math.radians(-28), 0), parent=root, segs=20)
    for k in range(4):
        off = Vector(((k - 1.5) * 0.008 * 0.3, (k - 1.5) * 0.0085, 0))
        b = palm + d * 0.018 + off
        tube(f'Finger{s}{k}', [(*b, 1.0), (*(b + d * 0.02 + Vector((0, -0.004, 0))), 0.9), (*(b + d * 0.034 + Vector((s * -0.004, -0.008, 0))), 0.75)], 0.0052 - abs(k - 1.5) * 0.0004, M['skin'], res=3)
    tb = palm + Vector((-s * 0.006, -0.016, 0.004))
    tube(f'Thumb{s}', [(*tb, 1.0), (*(tb + d * 0.012 + Vector((0, -0.01, 0))), 0.9), (*(tb + d * 0.022 + Vector((0, -0.014, 0))), 0.8)], 0.0058, M['skin'], res=3)
for s in (1, -1):
    arm(s)

# ------------------------------------------------------------------ inner dress: bodice details + skirt
for k, z in enumerate((1.075, 1.035, 0.995, 0.955)):
    w = 0.046 - k * 0.003
    pts = []
    for i in range(7):
        x = -w + 2 * w * i / 6
        pts.append((x, front_y(torso_tree, x, z, -0.07) - 0.004, z))
    trim_along(f'GoldStrap{k}', pts, M['gold'], w=0.0045, t=0.002)
    for s in (1, -1):
        x = s * w
        ellipsoid(f'StrapButton{k}{s}', (x, front_y(torso_tree, x, z, -0.07) - 0.006, z), (0.0055, 0.0035, 0.0055), M['gold'], parent=root, segs=12)
seam = [(0, front_y(torso_tree, 0, z, -0.07) - 0.003, z) for z in [1.12 - 0.03 * k for k in range(9)]]
trim_along('DressSeam', seam, M['cuff'], w=0.003, t=0.002)
lathe('Waistband', [(0.073, 0.93), (0.074, 0.905)], M['cuff'], 64, center=(0, 0.006, 0), parent=root)
def pleat(t, r, z):
    k = 20
    tri = abs(((t * k / (2 * math.pi)) % 1) - 0.5) * 2
    depth = min(1, (0.905 - z) / 0.15)
    return (r * (1 + 0.07 * (tri - 0.5) * depth), 0.0)
sk = lathe('Skirt', [(0.08, 0.905), (0.11, 0.85), (0.15, 0.77), (0.17, 0.72)], M['skirt'], 200, center=(0, 0.008, 0), parent=root, radial=pleat)
solidify(sk, 0.004)
lathe('SkirtFrill', [(0.165, 0.73), (0.18, 0.705), (0.182, 0.7)], M['frill'], 160, center=(0, 0.008, 0), parent=root,
      radial=lambda t, r, z: (r * (1 + 0.035 * math.sin(36 * t)), 0.004 * math.sin(36 * t)))

# shirt collar + ribbon at the throat
lathe('ShirtCollar', [(0.034, 1.24), (0.037, 1.212), (0.043, 1.19)], M['shirt'], 40, center=(0, 0.004, 0), parent=root)
for s in (1, -1):
    ellipsoid(f'Bow{s}', (s * 0.014, -0.045, 1.188), (0.014, 0.0055, 0.009), M['ribbon'], rot=(0, s * 0.35, 0), parent=root)
ellipsoid('BowKnot', (0, -0.047, 1.187), (0.005, 0.005, 0.006), M['ribbon'], parent=root)

# ------------------------------------------------------------------ long coat (open front, knee length)
coat_rings = [(1.17, 0.118, 0.22), (1.12, 0.15, 0.30), (1.05, 0.16, 0.42), (0.97, 0.15, 0.50), (0.90, 0.15, 0.52),
              (0.80, 0.18, 0.55), (0.68, 0.21, 0.6), (0.56, 0.235, 0.66), (0.47, 0.25, 0.7)]
coat, eL, eR = arc_shell('Coat', coat_rings, M['coat'], center=(0, 0.012), segs=140, ell=0.8, fold=0.035, fold_k=9)
solidify(coat, 0.006)
names = [m.name for m in coat.data.materials]
coat.data.materials.append(M['coat_in'])
for poly in coat.data.polygons:
    radial = Vector((poly.center.x, poly.center.y - 0.012, 0))
    if radial.length > 1e-6 and poly.normal.dot(radial.normalized()) < -0.2:
        poly.material_index = 1
# white trim along both front edges and around the hem
trim_along('CoatTrimL', [p + Vector((0, -0.002, 0)) for p in eL], M['trim'], w=0.011, t=0.004)
trim_along('CoatTrimR', [p + Vector((0, -0.002, 0)) for p in eR], M['trim'], w=0.011, t=0.004)
hem = []
z, r, gap = coat_rings[-1]
for k in range(97):
    a = -math.pi / 2 + gap + (2 * math.pi - 2 * gap) * k / 96
    rr = r * (1 + 0.035 * math.sin(9 * a))
    hem.append(Vector((rr * math.cos(a) * 1.02, 0.012 + rr * math.sin(a) * 0.8 * 1.02, z + 0.004)))
trim_along('CoatHemTrim', hem, M['trim'], w=0.011, t=0.004)
# back vent seam + pocket flaps with gold buttons
for s in (1, -1):
    x = s * 0.15
    cy = 0.012 - math.sqrt(max(0, 0.19 ** 2 - x * x)) * 0.8 - 0.004
    box(f'Pocket{s}', (x, cy, 0.76), (0.06, 0.006, 0.024), M['coat'], rot=(0, 0, s * 0.35), parent=root, bevel=0.003)
    box(f'PocketTrim{s}', (x, cy - 0.003, 0.772), (0.062, 0.004, 0.005), M['trim'], rot=(0, 0, s * 0.35), parent=root)

# layered capelet (two tiers) with white trim, and a high stand collar
for tier, (z0, z1, r1, gap) in enumerate(((1.225, 1.02, 0.205, 0.62), (1.225, 1.095, 0.18, 0.7))):
    rings = [(z0, 0.056, gap * 0.6), (z0 - 0.035, 0.1, gap * 0.75), (z0 - 0.08, 0.14, gap * 0.9), ((z0 + z1) / 2 - 0.03, 0.17, gap), (z1, r1, gap * 1.05)]
    cap, cl, cr = arc_shell(f'Capelet{tier}', rings, M['coat'], center=(0, 0.014), segs=120, ell=0.78, fold=0.02, fold_k=11)
    solidify(cap, 0.005)
    rim = []
    for k in range(97):
        a = -math.pi / 2 + gap * 1.05 + (2 * math.pi - 2 * gap * 1.05) * k / 96
        rr = r1 * (1 + 0.02 * math.sin(11 * a))
        rim.append(Vector((rr * math.cos(a) * 1.02, 0.014 + rr * math.sin(a) * 0.78 * 1.02, z1 + 0.003)))
    trim_along(f'CapeletTrim{tier}', rim, M['trim'], w=0.009, t=0.0035)
collar = lathe('StandCollar', [(0.047, 1.232), (0.05, 1.212), (0.056, 1.195)], M['coat'], 64, center=(0, 0.012, 0), parent=root,
               radial=lambda t, r, z: (r if math.sin(t) > -0.75 else r * 0.001, 0))
lathe('StandCollarTrim', [(0.0475, 1.236), (0.049, 1.229)], M['trim'], 64, center=(0, 0.012, 0), parent=root,
      radial=lambda t, r, z: (r if math.sin(t) > -0.75 else r * 0.001, 0))
for s in (1, -1):
    ellipsoid(f'CapeClasp{s}', (s * 0.032, -0.05, 1.205), (0.008, 0.004, 0.008), M['gold'], parent=root, segs=14)

# ------------------------------------------------------------------ head, face, pointed ears
def head_mesh():
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=48, radius=HR)
    for v in bm.verts:
        if v.co.z < 0:
            t = -v.co.z / HR
            v.co.x *= 1 - 0.34 * t ** 1.35
            v.co.y *= 1 - 0.2 * t
            v.co.y -= 0.013 * t ** 2
            v.co.z *= 1.04
        else:
            v.co.z *= 1.03              # anime cranium
        v.co.y *= 0.95
        v.co += HC
    return bm
mesh_obj('HeadMesh', head_mesh(), M['skin'], head_pivot)
def face_shell():
    bm = head_mesh()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().y > HC.y - 0.035], context='FACES')
    for v in bm.verts:
        v.co += (v.co - HC).normalized() * 0.0012
    uv = bm.loops.layers.uv.new('UVMap')
    R = 0.115 * HR / 0.098
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (0.5 + (l.vert.co.x - HC.x) / (2 * R), 0.5 + (l.vert.co.z - HC.z) / (2 * R))
    return bm
mesh_obj('Face', face_shell(), M['face'], head_pivot)
ellipsoid('Nose', (0, HC.y - HR * 0.95 + 0.004, HC.z - 0.031), (0.0042, 0.0038, 0.0058), M['skin'], parent=head_pivot, segs=12)
for s in (1, -1):
    # long Migurd ear, pointing out and slightly up/back
    base = Vector((s * HR * 0.9, HC.y + 0.012, HC.z - 0.012))
    tip = base + Vector((s * 0.06, 0.03, 0.03))
    strand(f'Ear{s}', [(*base, 1.0), (*base.lerp(tip, 0.45), 0.85), (*tip, 0.08)], M['skin'], width=0.017, thick=0.007, parent=head_pivot, res=8, tilt=s * 0.3)

# ------------------------------------------------------------------ hair
H = lambda x, y, z: Vector((HC.x + x, HC.y + y, HC.z + z))
hair = []
def clump(name, pts, w, t, res=8):
    ob = strand(name, [(*p, r) for p, r in pts], M['hair'], width=w, thick=t, parent=head_pivot, res=res)
    hair.append(ob); return ob
def hair_cap():
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=40, radius=HR * 1.1)
    for v in bm.verts:
        v.co.z *= 1.03; v.co.y *= 0.98
        v.co += HC + Vector((0, 0.008, 0.012))
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if (lambda c: c.z < -0.1 or (c.y < -0.025 and c.z < 0.05) or (c.y < 0.0 and c.z < -0.03 and abs(c.x) < 0.09))(f.calc_center_median() - HC)], context='FACES')
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=0.006)
    for v in bm.verts:
        c = v.co - HC
        v.co += c.normalized() * 0.0018 * math.sin(math.atan2(c.y, c.x) * 24)
    return bm
cap = mesh_obj('HairCap', hair_cap(), M['hair'], head_pivot); hair.append(cap)
# bangs: big pointed anime clumps, two layers, longer ones between the eyes
for layer in (0, 1):
    n = 9 - layer
    for i in range(n):
        x = -0.085 + 0.17 * (i + 0.5 * layer) / (n - 1 + 0.5 * layer)
        tip = 0.004 + 1.9 * x * x - (0.012 if abs(x) < 0.03 else 0)
        sway = 0.008 * math.sin(i * 2.1 + layer)
        clump(f'Bang{layer}{i}', [
            (H(x * 0.35, 0.01, 0.128), 1.0), (H(x * 0.85, -0.066 + layer * 0.004, 0.108), 1.0),
            (H(x * 1.04 + sway, -HR - 0.008 + layer * 0.004, 0.062), 0.9),
            (H(x * 1.08 + sway * 1.6, -HR - 0.018, tip + 0.016 + layer * 0.012), 0.45),
            (H(x * 1.04 + sway * 2.2, -HR - 0.014, tip + layer * 0.012), 0.03)], 0.026 - layer * 0.004, 0.012)
# side locks in front of the ears, to the chest
for s in (1, -1):
    for j, off in enumerate((0.0, 0.018)):
        clump(f'SideLock{s}{j}', [
            (H(s * (0.078 + off), -0.055, 0.085), 1.0), (H(s * (0.104 + off), -0.068 + off, 0.0), 1.0),
            (H(s * (0.11 + off * 1.3), -0.062 + off, -0.1), 0.9), (H(s * (0.116 + off), -0.055 + off, -0.19 + off), 0.6),
            (H(s * (0.122 + off), -0.048 + off, -0.255 + off * 1.6), 0.03)], 0.021, 0.011)
# voluminous long back hair to the waist, two layers fanning outward
for layer in (0, 1):
    n = 15
    for i in range(n):
        a = (i / (n - 1) - 0.5) * 2.5
        x, yb = math.sin(a) * 0.105, math.cos(a) * 0.105
        L = 0.42 + 0.05 * math.cos(i * 1.7 + layer) - layer * 0.06
        fan = 1.25 + 0.15 * layer
        clump(f'Back{layer}{i}', [
            (H(x * 0.55, yb * 0.4, 0.11), 1.0), (H(x * 1.08, yb + 0.014 + layer * 0.01, 0.02), 1.0),
            (H(x * 1.2, yb + 0.036 + layer * 0.012, -0.13), 0.97), (H(x * fan, yb + 0.05 + layer * 0.012, -0.13 - L * 0.55), 0.8),
            (H(x * (fan + 0.05) + 0.012 * math.sin(i), yb + 0.054 + layer * 0.012, -0.13 - L), 0.03)], 0.036 - layer * 0.005, 0.013)
# side volume over the ears
for s in (1, -1):
    for j in range(3):
        clump(f'Volume{s}{j}', [(H(s * 0.06, 0.02 - j * 0.02, 0.1), 1.0), (H(s * 0.118, 0.01 - j * 0.02, 0.03), 1.0), (H(s * 0.128, 0.02 - j * 0.015, -0.06), 0.7), (H(s * 0.12, 0.03 - j * 0.01, -0.12), 0.03)], 0.032, 0.013)
# ahoge
clump('Ahoge', [(H(0.0, 0.01, 0.125), 1.0), (H(0.006, -0.01, 0.17), 0.85), (H(0.025, -0.02, 0.205), 0.6), (H(0.05, -0.005, 0.215), 0.25), (H(0.06, 0.012, 0.205), 0.02)], 0.011, 0.005)
# two long braids hanging in front of the shoulders down to the hips
def braid(s):
    path = [H(s * 0.095, 0.0, -0.065), Vector((s * 0.128, -0.03, 1.13)), Vector((s * 0.15, -0.055, 1.0)),
            Vector((s * 0.158, -0.062, 0.88)), Vector((s * 0.16, -0.06, 0.78))]
    def at(t):
        n = len(path) - 1
        i = min(int(t * n), n - 1); u = t * n - i
        p0, p1, p2, p3 = path[max(i - 1, 0)], path[i], path[i + 1], path[min(i + 2, n)]
        return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)
    lobes = 30
    for k in range(lobes):
        t = k / (lobes - 1)
        p = at(t)
        tan = (at(min(1, t + 0.01)) - at(max(0, t - 0.01))).normalized()
        side_v = tan.cross(Vector((0, 1, 0))).normalized()
        r = 0.026 * (1 - 0.3 * t)
        q = tan.to_track_quat('Z', 'Y')
        rot = (q.to_matrix().to_4x4() @ Matrix.Rotation(math.radians(38 if k % 2 else -38), 4, 'Y')).to_euler()
        hair.append(ellipsoid(f'Braid{s}_{k}', p + side_v * (r * 0.42 * (1 if k % 2 else -1)), (r * 0.86, r * 0.7, r * 1.45), M['hair'], rot=tuple(rot), parent=head_pivot, segs=18))
    end = at(1.0)
    for b in (1, -1):
        ellipsoid(f'BraidBow{s}{b}', end + Vector((b * 0.02, -0.006, -0.012)), (0.019, 0.006, 0.011), M['ribbon'], rot=(0, b * 0.5, 0), parent=head_pivot)
    ellipsoid(f'BraidKnot{s}', end + Vector((0, -0.008, -0.012)), (0.007, 0.007, 0.008), M['ribbon'], parent=head_pivot)
    for j in range(7):
        a = (j - 3) * 0.3
        hair.append(strand(f'BraidTuft{s}{j}', [(*(end + Vector((0, 0, -0.02))), 1), (*(end + Vector((math.sin(a) * 0.02, 0.003 * j - 0.009, -0.065))), 0.8), (*(end + Vector((math.sin(a) * 0.032, 0.004 * j - 0.012, -0.11))), 0.03)],
                           M['hair'], width=0.011, thick=0.0045, parent=head_pivot, res=6))
for s in (1, -1):
    braid(s)

# ------------------------------------------------------------------ display disc (like the reference turnaround)
base = empty('Base', (0, 0, 0), figure)
for ob in (lathe('BaseDisc', [(0.0, 0.04), (0.28, 0.04), (0.29, 0.034), (0.292, 0.006), (0.286, 0.0), (0.0, 0.0)], M['base'], 128),
           lathe('BaseRim', [(0.2915, 0.032), (0.293, 0.026)], M['base_rim'], 128)):
    ob.parent = base; ob.matrix_parent_inverse = Matrix.Identity(4)
root.location.z += BASE_H
bpy.context.view_layer.update()

# ------------------------------------------------------------------ bake soft AO + hair gradient into vertex colours
meshes = [o for o in col.objects if o.type == 'MESH']
for o in meshes:
    if not o.data.color_attributes.get('Col'):
        o.data.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    o.data.color_attributes.active_color = o.data.color_attributes['Col']
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 48
w = bpy.data.worlds.new('BakeWorld'); scene.world = w; w.light_settings.distance = 0.05
for o in bpy.context.view_layer.objects:
    o.select_set(o.type == 'MESH' and o.name != 'Face')
bpy.context.view_layer.objects.active = meshes[0]
scene.render.bake.target = 'VERTEX_COLORS'
bpy.ops.object.bake(type='AO')
print('AO baked')
hair_names = {o.name for o in hair}
for o in meshes:
    ca = o.data.color_attributes['Col']
    mw = o.matrix_world
    is_hair = o.name in hair_names
    for loop in o.data.loops:
        c = ca.data[loop.index].color
        ao = 0.6 + 0.4 * c[0]
        if is_hair:
            z = (mw @ o.data.vertices[loop.vertex_index].co).z
            t = max(0.0, min(1.0, (HC.z + BASE_H + 0.12 - z) / 0.7))
            shade = 0.78 + 0.22 * t ** 0.5
            ring = 0.22 * math.exp(-((z - (HC.z + BASE_H + 0.075)) / 0.012) ** 2)
            v = min(1, ao * shade + ring)
            ca.data[loop.index].color = (v, min(1, v + ring * 0.2), min(1, v + ring * 0.4), 1)
        else:
            ca.data[loop.index].color = (ao, ao, ao, 1)

for o in list(col.objects):
    if o.type == 'CURVE':
        bpy.data.objects.remove(o)
# every closed mesh: outward normals (the web outline pass relies on front faces)
for o in col.objects:
    if o.type == 'MESH' and o.name != 'Face':
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(o.data); bm.free()
print('total verts', sum(len(o.data.vertices) for o in col.objects if o.type == 'MESH'))
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB', export_apply=True, export_yup=True,
                          export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='AUTO',
                          export_vertex_color='ACTIVE',
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                          export_draco_position_quantization=14, export_draco_normal_quantization=10,
                          export_draco_texcoord_quantization=12, export_draco_color_quantization=8)
print('exported', OUT_GLB, os.path.getsize(OUT_GLB) // 1024, 'KB')

if PREVIEW:
    world = bpy.data.worlds.new('W'); scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.02, 0.03, 1)
    for (rx, ry, rz, e) in ((45, -15, -35, 3.2), (70, 0, 160, 2.2), (80, 0, 20, 0.8)):
        sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN')); sun.data.energy = e
        sun.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz)); col.objects.link(sun)
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); cam.data.lens = 85; col.objects.link(cam); scene.camera = cam
    scene.cycles.samples = int(os.environ.get('SAMPLES', 32)); scene.cycles.use_denoising = True
    views = {'front': (0, 0.95, 6.6), 'three_quarter': (-35, 0.95, 6.6), 'side': (-90, 0.95, 6.6), 'back': (180, 0.95, 6.6), 'face': (-18, 1.36, 1.5)}
    for name in os.environ.get('VIEWS', 'front,three_quarter,back,face').split(','):
        yaw, z, dist = views[name]
        a = math.radians(yaw)
        cam.location = (dist * math.sin(a), -dist * math.cos(a), z + 0.12)
        cam.rotation_euler = (Vector((0, 0, z)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.resolution_x, scene.render.resolution_y = ((480, 820) if name != 'face' else (600, 600))
        scene.render.filepath = os.path.join(PREVIEW, f'anime_{name}.png')
        bpy.ops.render.render(write_still=True)
        print('rendered', name)
