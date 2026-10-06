# Detailed anime face decal (figure paint style) for Roxy, 2048 px, transparent background.
# Same projection as v1: canvas covers head-local x,z in [-R, R] (front orthographic).
import sys, math
from PIL import Image, ImageDraw, ImageFilter

N = 2048
R = 0.115
S = N / (2 * R)
def px(x, z):
    return (N / 2 + x * S, N / 2 - z * S)

def layer():
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)

out = Image.new('RGBA', (N, N), (0, 0, 0, 0))

def smooth_path(pts, n=24):
    # Catmull-Rom through the points -> dense polyline (pixel coords)
    P = [pts[0]] + list(pts) + [pts[-1]]
    res = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            res.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3) for j in (0, 1)))
    res.append(pts[-1])
    return res

def stroke(d, pts, fill, width, taper=True):
    path = smooth_path(pts)
    for i in range(len(path) - 1):
        t = i / (len(path) - 1)
        w = width * (0.35 + 0.65 * math.sin(math.pi * min(1, t * 1.15)) ** 0.6) if taper else width
        d.line([path[i], path[i + 1]], fill=fill, width=max(2, int(w)))
        r = w / 2
        d.ellipse([path[i][0] - r, path[i][1] - r, path[i][0] + r, path[i][1] + r], fill=fill)

def eye(cx, side):
    global out
    ez = -0.004
    w, h = 0.0215, 0.0265
    # --- sclera with soft top shadow (cast by the lid)
    sc, d = layer()
    d.ellipse([*px(cx - w, ez + h * 0.92), *px(cx + w, ez - h * 0.9)], fill=(252, 250, 250, 255))
    sh, ds = layer()
    ds.ellipse([*px(cx - w * 1.1, ez + h * 1.3), *px(cx + w * 1.1, ez + h * 0.35)], fill=(170, 160, 190, 150))
    sh = sh.filter(ImageFilter.GaussianBlur(18))
    mask = sc.split()[3]
    sc = Image.alpha_composite(sc, Image.composite(sh, Image.new('RGBA', (N, N), (0, 0, 0, 0)), mask))
    out = Image.alpha_composite(out, sc)

    # --- iris: vertical gradient + radial striations + dark rim + top shade band
    iw, ih = w * 0.8, h * 0.88
    icx = cx + side * 0.0012
    box = [*px(icx - iw, ez + ih * 0.95), *px(icx + iw, ez - ih)]
    iris, di = layer()
    top, bot = int(box[1]), int(box[3])
    for y in range(top, bot + 1):
        t = (y - top) / max(1, bot - top)
        col = (int(22 + 95 * t ** 1.3), int(40 + 130 * t ** 1.2), int(120 + 125 * t), 255)
        di.line([(box[0] - 4, y), (box[2] + 4, y)], fill=col)
    ccx, ccy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    rx, ry = (box[2] - box[0]) / 2, (box[3] - box[1]) / 2
    st, dst = layer()
    for k in range(72):                       # striations
        a = 2 * math.pi * k / 72
        r0 = 0.35 + 0.05 * math.sin(k * 3.1)
        dst.line([(ccx + rx * r0 * math.cos(a), ccy + ry * r0 * math.sin(a)), (ccx + rx * 0.95 * math.cos(a), ccy + ry * 0.95 * math.sin(a))],
                 fill=(200, 230, 255, 46 if k % 2 else 22), width=3)
    iris = Image.alpha_composite(iris, st.filter(ImageFilter.GaussianBlur(1)))
    shd, dsh = layer()
    dsh.ellipse([ccx - rx * 1.1, ccy - ry * 1.15, ccx + rx * 1.1, ccy - ry * 0.1], fill=(8, 14, 60, 150))  # top shade
    iris = Image.alpha_composite(iris, shd.filter(ImageFilter.GaussianBlur(14)))
    # bright lower crescent
    cr, dc = layer()
    dc.ellipse([ccx - rx * 0.7, ccy + ry * 0.25, ccx + rx * 0.7, ccy + ry * 0.9], fill=(150, 215, 255, 150))
    cr = cr.filter(ImageFilter.GaussianBlur(10))
    iris = Image.alpha_composite(iris, cr)
    m = Image.new('L', (N, N), 0)
    ImageDraw.Draw(m).ellipse(box, fill=255)
    m = Image.composite(m, Image.new('L', (N, N), 0), mask)       # clip to sclera
    out.paste(iris, (0, 0), m)
    d = ImageDraw.Draw(out)
    d.ellipse(box, outline=(14, 22, 66, 255), width=9)
    # pupil
    pw, ph = rx * 0.38, ry * 0.42
    d.ellipse([ccx - pw, ccy - ph * 0.9, ccx + pw, ccy + ph * 1.05], fill=(12, 16, 52, 255))
    # highlights: big oval, small round, tiny sparkle
    hx = ccx - side * rx * 0.38
    d.ellipse([hx - rx * 0.3, ccy - ry * 0.62, hx + rx * 0.3, ccy - ry * 0.12], fill=(255, 255, 255, 255))
    d.ellipse([ccx + side * rx * 0.42 - rx * 0.13, ccy + ry * 0.42 - rx * 0.13, ccx + side * rx * 0.42 + rx * 0.13, ccy + ry * 0.42 + rx * 0.13], fill=(235, 248, 255, 245))
    d.ellipse([ccx - side * rx * 0.05 - 6, ccy + ry * 0.05 - 6, ccx - side * rx * 0.05 + 6, ccy + ry * 0.05 + 6], fill=(255, 255, 255, 200))

    # --- upper lid: thick lash line with wing and individual lashes
    lid = [px(cx - side * w * 1.08, ez + h * 0.5), px(cx - side * w * 0.55, ez + h * 0.98), px(cx, ez + h * 1.1),
           px(cx + side * w * 0.55, ez + h * 1.02), px(cx + side * w * 1.15, ez + h * 0.55)]
    stroke(d, lid + [px(cx + side * w * 1.4, ez + h * 0.3)], (26, 18, 34, 255), 30)
    for k in range(3):                         # a few outer lashes, curved
        t = 0.7 + k * 0.17
        bx, bz = cx + side * w * t * 1.05, ez + h * (0.95 - (t - 0.5) * 0.75)
        stroke(d, [px(bx, bz), px(bx + side * 0.004, bz + 0.004), px(bx + side * 0.009, bz + 0.005 - k * 0.0012)], (26, 18, 34, 255), 9)
    # crease (double eyelid)
    stroke(d, [px(cx - side * w * 0.6, ez + h * 1.3), px(cx + side * w * 0.2, ez + h * 1.42), px(cx + side * w * 0.95, ez + h * 1.12)], (160, 105, 115, 170), 6)
    # lower lash
    stroke(d, [px(cx - side * w * 0.45, ez - h * 0.98), px(cx + side * w * 0.2, ez - h * 1.02), px(cx + side * w * 0.8, ez - h * 0.8)], (95, 62, 82, 220), 8)
    # eyebrow
    stroke(d, [px(cx - side * w * 0.95, ez + h * 1.88), px(cx, ez + h * 2.05), px(cx + side * w * 0.95, ez + h * 1.95)], (72, 82, 160, 235), 11)

for side, x in ((-1, -0.034), (1, 0.034)):
    eye(x, side)

d = ImageDraw.Draw(out)
# nose shadow, small closed smile with lip tint
d.line([px(0.0015, -0.027), px(0.003, -0.034)], fill=(205, 140, 130, 170), width=7)
d.arc([*px(-0.0095, -0.046), *px(0.0095, -0.058)], start=25, end=155, fill=(150, 72, 82, 255), width=9)
d.arc([*px(-0.004, -0.0565), *px(0.004, -0.0605)], start=20, end=160, fill=(205, 120, 125, 160), width=5)
# blush with anime hatching
bl, db = layer()
for x in (-0.05, 0.05):
    db.ellipse([*px(x - 0.018, -0.025), *px(x + 0.018, -0.042)], fill=(245, 135, 150, 120))
bl = bl.filter(ImageFilter.GaussianBlur(22))
out = Image.alpha_composite(bl, out)
d = ImageDraw.Draw(out)
for x in (-0.05, 0.05):
    for k in range(3):
        sx = x - 0.008 + k * 0.007
        d.line([px(sx, -0.029), px(sx - 0.003, -0.037)], fill=(225, 110, 125, 190), width=5)
out.save(sys.argv[1], optimize=True)
