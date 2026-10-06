# Anime face decal for Roxy: transparent PNG mapped by front orthographic projection of the
# head. Canvas covers x,z in [-R, R] around the head centre (u = right of viewer).
import sys
from PIL import Image, ImageDraw, ImageFilter
N = 1024
R = 0.115                      # metres covered by half the canvas (head radius ~0.105)
def px(x, z):                  # head-local metres -> pixels (z up)
    return (N / 2 + x / R * N / 2, N / 2 - z / R * N / 2)
img = Image.new('RGBA', (N, N), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

def eye(cx, side):
    ex, ez = cx, -0.004                     # eye centre (head-local)
    w, h = 0.0205, 0.0255                   # half sizes
    # sclera
    d.ellipse([*px(ex - w, ez + h * 0.95), *px(ex + w, ez - h * 0.9)], fill=(250, 250, 252, 255))
    # iris with vertical gradient
    iw, ih = w * 0.78, h * 0.86
    box = [*px(ex - iw + side * 0.0015, ez + ih * 0.92), *px(ex + iw + side * 0.0015, ez - ih)]
    iris = Image.new('RGBA', (N, N), (0, 0, 0, 0)); g = ImageDraw.Draw(iris)
    top, bot = box[1], box[3]
    for i in range(int(top), int(bot) + 1):
        t = (i - top) / max(1, bot - top)
        col = (int(28 + 70 * t), int(52 + 110 * t), int(140 + 95 * t), 255)
        g.line([(box[0] - 5, i), (box[2] + 5, i)], fill=col)
    m = Image.new('L', (N, N), 0); ImageDraw.Draw(m).ellipse(box, fill=255)
    img.paste(iris, (0, 0), m)
    # pupil + ring
    pw, ph = iw * 0.42, ih * 0.5
    d.ellipse([*px(ex - pw + side * 0.0015, ez + ph * 0.7), *px(ex + pw + side * 0.0015, ez - ph * 1.1)], fill=(18, 26, 70, 255))
    d.ellipse(box, outline=(20, 30, 80, 255), width=6)
    # highlights
    hx = ex - side * 0.006
    d.ellipse([*px(hx - 0.0055, ez + 0.0135), *px(hx + 0.0055, ez + 0.0025)], fill=(255, 255, 255, 255))
    d.ellipse([*px(ex + side * 0.008 - 0.0025, ez - 0.0105), *px(ex + side * 0.008 + 0.0025, ez - 0.0155)], fill=(225, 240, 255, 240))
    # thick upper lash line (arched), with outer flick
    pts = [px(ex - side * w * 1.05, ez + h * 0.55), px(ex - side * w * 0.4, ez + h * 1.05), px(ex + side * w * 0.45, ez + h * 1.02), px(ex + side * w * 1.18, ez + h * 0.45)]
    d.line(pts, fill=(22, 18, 30, 255), width=20, joint='curve')
    d.line([pts[-1], px(ex + side * w * 1.38, ez + h * 0.2)], fill=(22, 18, 30, 255), width=12)
    # lower lash hint
    d.line([px(ex - side * w * 0.5, ez - h * 0.98), px(ex + side * w * 0.65, ez - h * 0.88)], fill=(70, 50, 70, 200), width=5)
    # eyebrow (mostly hidden by bangs)
    d.line([px(ex - side * w * 0.9, ez + h * 1.75), px(ex + side * w * 0.9, ez + h * 1.85)], fill=(70, 80, 150, 220), width=7)

for side, x in ((-1, -0.034), (1, 0.034)):
    eye(x, side)
# nose hint, mouth, blush
d.line([px(0.0, -0.032), px(0.0015, -0.036)], fill=(200, 140, 135, 200), width=4)
d.arc([*px(-0.009, -0.047), *px(0.009, -0.059)], start=20, end=160, fill=(150, 70, 80, 255), width=7)
blush = Image.new('RGBA', (N, N), (0, 0, 0, 0)); b = ImageDraw.Draw(blush)
for x in (-0.05, 0.05):
    b.ellipse([*px(x - 0.017, -0.026), *px(x + 0.017, -0.041)], fill=(245, 140, 150, 110))
img = Image.alpha_composite(blush.filter(ImageFilter.GaussianBlur(14)), img)
img.save(sys.argv[1])
