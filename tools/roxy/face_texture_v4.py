# Cel-anime face decal for Roxy, playful wink like the TV anime: character's right eye closed
# (thick arched lash line), left eye open (navy gradient iris, thick upper lash, small lower
# lash ticks), tiny nose mark, small closed smile. 2048 px, transparent background.
# Same projection as v1/v2: canvas covers face-local x,z in [-R, R], eyes at x = +-0.034, z = -0.004.
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

def stroke(d, pts, fill, width, start=0.35, end=0.35):
    # tapered brush stroke: thin at both ends (start/end = relative end widths)
    path = smooth_path(pts)
    for i in range(len(path) - 1):
        t = i / (len(path) - 1)
        k = min(1, t / 0.3) if t < 0.3 else (min(1, (1 - t) / 0.3))
        base = start if t < 0.5 else end
        w = width * (base + (1 - base) * math.sin(k * math.pi / 2))
        d.line([path[i], path[i + 1]], fill=fill, width=max(2, int(w)))
        r = w / 2
        d.ellipse([path[i][0] - r, path[i][1] - r, path[i][0] + r, path[i][1] + r], fill=fill)

out = Image.new('RGBA', (N, N), (0, 0, 0, 0))
LASH = (24, 20, 34, 255)
EZ = -0.004

def eye(cx, side):
    global out
    w, h = 0.0235, 0.0215
    o = lambda f: cx + side * w * f          # f>0 toward the outer corner
    upper = [px(o(-1.0), EZ + h * 0.05), px(o(-0.6), EZ + h * 0.72), px(o(0.0), EZ + h * 1.0),
             px(o(0.55), EZ + h * 0.9), px(o(1.0), EZ + h * 0.42)]
    lower = [px(o(1.0), EZ + h * 0.42), px(o(0.8), EZ - h * 0.45), px(o(0.25), EZ - h * 0.9),
             px(o(-0.45), EZ - h * 0.72), px(o(-1.0), EZ + h * 0.05)]
    shape = smooth_path(upper) + smooth_path(lower)

    # sclera + mask
    mask = Image.new('L', (N, N), 0)
    ImageDraw.Draw(mask).polygon(shape, fill=255)
    sc, d = layer()
    d.polygon(shape, fill=(252, 252, 255, 255))
    out = Image.alpha_composite(out, sc)

    # iris: vertical gradient, darker top, clipped by the lids
    irx, irz = 0.0128, 0.0182
    icx, icz = cx + side * 0.0008, EZ - h * 0.08
    box = [*px(icx - irx, icz + irz), *px(icx + irx, icz - irz)]
    iris, di = layer()
    top, bot = int(box[1]), int(box[3])
    for y in range(top, bot + 1):
        t = (y - top) / max(1, bot - top)
        di.line([(box[0] - 2, y), (box[2] + 2, y)], fill=(int(22 + 70 * t ** 1.5), int(32 + 110 * t ** 1.4), int(92 + 130 * t ** 1.1), 255))
    ccx, ccy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    rx, ry = (box[2] - box[0]) / 2, (box[3] - box[1]) / 2
    pd = ImageDraw.Draw(iris)
    pd.ellipse([ccx - rx * 0.42, ccy - ry * 0.5, ccx + rx * 0.42, ccy + ry * 0.36], fill=(16, 22, 62, 255))       # pupil
    pd.ellipse([ccx - rx * 0.7, ccy + ry * 0.38, ccx + rx * 0.7, ccy + ry * 0.86], fill=(140, 200, 255, 150))     # lower glow
    imask = Image.new('L', (N, N), 0)
    ImageDraw.Draw(imask).ellipse(box, fill=255)
    rim, dr = layer()
    dr.ellipse(box, outline=(18, 26, 74, 255), width=8)
    iris = Image.alpha_composite(iris, rim)
    clip = Image.composite(imask, Image.new('L', (N, N), 0), mask)
    out.paste(iris, (0, 0), clip)

    # lid shadow on the white + iris (cel band, hard edge)
    shd, ds = layer()
    sh_pts = smooth_path(upper)
    ds.polygon(sh_pts + [(p[0], p[1] + rx * 0.42) for p in reversed(sh_pts)], fill=(70, 72, 130, 110))
    out.paste(Image.alpha_composite(Image.new('RGBA', (N, N), (0, 0, 0, 0)), shd), (0, 0), Image.composite(shd.split()[3], Image.new('L', (N, N), 0), mask))

    d = ImageDraw.Draw(out)
    # highlights
    hx = ccx - side * rx * 0.34
    d.ellipse([hx - rx * 0.3, ccy - ry * 0.56, hx + rx * 0.3, ccy - ry * 0.16], fill=(255, 255, 255, 255))
    lx = ccx + side * rx * 0.38
    d.ellipse([lx - rx * 0.13, ccy + ry * 0.36, lx + rx * 0.13, ccy + ry * 0.56], fill=(240, 248, 255, 240))

    # thick upper lash line with an outer flick, thin lower line on the outer half
    stroke(d, upper + [px(o(1.22), EZ + h * 0.18)], LASH, 38, start=0.25, end=0.45)
    stroke(d, [px(o(0.75), EZ + h * 0.62), px(o(1.12), EZ + h * 0.62), px(o(1.32), EZ + h * 0.55)], LASH, 16, start=0.6, end=0.2)
    stroke(d, [px(o(1.0), EZ + h * 0.3), px(o(0.8), EZ - h * 0.47), px(o(0.25), EZ - h * 0.93), px(o(-0.15), EZ - h * 0.9)], (60, 42, 60, 255), 9, start=0.8, end=0.15)
    for k in range(3):                         # small lower lash ticks at the outer corner
        b = (o(0.55 + k * 0.17), EZ - h * (0.78 - k * 0.22))
        stroke(d, [px(*b), px(b[0] + side * w * 0.12, b[1] - h * 0.22)], (60, 42, 60, 255), 6, start=0.9, end=0.2)
    # lid crease
    stroke(d, [px(o(-0.35), EZ + h * 1.32), px(o(0.25), EZ + h * 1.42), px(o(0.8), EZ + h * 1.18)], (170, 118, 120, 200), 6)
    # thin eyebrow
    stroke(d, [px(o(-0.9), EZ + h * 2.05), px(o(0.0), EZ + h * 2.35), px(o(0.95), EZ + h * 2.15)], (78, 96, 176, 235), 10, start=0.5, end=0.2)

def wink(cx, side):
    # closed eye: arch, thicker toward the outer corner, lashes flicking out and down
    w, h = 0.0235, 0.0215
    o = lambda f: cx + side * w * f
    d = ImageDraw.Draw(out)
    arch = [px(o(-0.95), EZ - h * 0.05), px(o(-0.45), EZ + h * 0.42), px(o(0.15), EZ + h * 0.55),
            px(o(0.7), EZ + h * 0.3), px(o(1.08), EZ - h * 0.12)]
    stroke(d, arch, LASH, 38, start=0.2, end=0.75)
    for k, (dx, dz) in enumerate(((0.32, -0.42), (0.38, -0.2), (0.36, 0.05))):
        b = o(0.72 + k * 0.14), EZ + h * (0.24 - k * 0.14)
        stroke(d, [px(*b), px(b[0] + side * w * dx * 0.9, b[1] + h * dz), px(b[0] + side * w * dx * 1.6, b[1] + h * dz * 1.7)], LASH, 15, start=0.9, end=0.15)
    stroke(d, [px(o(-0.5), EZ + h * 0.98), px(o(0.15), EZ + h * 1.12), px(o(0.75), EZ + h * 0.88)], (170, 118, 120, 190), 6)
    stroke(d, [px(o(-0.9), EZ + h * 1.95), px(o(0.0), EZ + h * 2.25), px(o(0.95), EZ + h * 2.05)], (78, 96, 176, 235), 10, start=0.5, end=0.2)

wink(-0.034, -1)        # character's right eye (viewer's left) winks
eye(0.034, 1)

d = ImageDraw.Draw(out)
# tiny nose mark
stroke(d, [px(0.001, -0.0265), px(0.0022, -0.03)], (200, 132, 124, 230), 7, start=0.6, end=0.9)
# small closed smile, slightly lopsided like the reference
stroke(d, [px(-0.0075, -0.0445), px(-0.003, -0.0475), px(0.0025, -0.0478), px(0.0072, -0.0452), px(0.0088, -0.0436)], (120, 52, 60, 255), 8, start=0.3, end=0.5)
# soft blush + a small cheek highlight
bm = Image.new('L', (N, N), 0)
for x in (-0.048, 0.048):
    ImageDraw.Draw(bm).ellipse([*px(x - 0.017, -0.024), *px(x + 0.017, -0.038)], fill=95)
bl = Image.new('RGBA', (N, N), (246, 150, 160, 0))
bl.putalpha(bm.filter(ImageFilter.GaussianBlur(26)))   # colour stays pink, only alpha is blurred
out = Image.alpha_composite(bl, out)

out.save(sys.argv[1])
if len(sys.argv) > 2:
    prev = Image.new('RGBA', (N, N), (253, 227, 211, 255))
    prev.alpha_composite(out)
    prev.crop((N // 2 - 700, N // 2 - 520, N // 2 + 700, N // 2 + 700)).resize((700, 610)).save(sys.argv[2])
