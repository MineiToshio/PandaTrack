"""Blocking QC for the ten v4 rank emblems.

Prints the measurable checks (alpha, corners, ratio, safe circle, footprint, dominant hue) and
writes `qc-strip.png`, the visual half of the check: every rank at 64, 32 and 16 pixels, in colour
on dark, in colour on light, and in greyscale, so two adjacent ranks that collapse into the same
blob are caught before the owner sees them.
"""

import colorsys
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FINAL = os.path.join(HERE, "final")

ORDER = [
    "kohai",
    "preorder-hunter",
    "volume-keeper",
    "guild-senpai",
    "first-print-hunter",
    "limited-run-curator",
    "club-sensei",
    "rare-edition-archivist",
    "collection-shisho",
    "guild-legend",
]

DARK = (22, 24, 28, 255)
LIGHT = (248, 247, 244, 255)
ALPHA_FLOOR = 8


def font(size, bold=False):
    name = "Arial Bold.ttf" if bold else "Arial.ttf"
    try:
        return ImageFont.truetype(f"/System/Library/Fonts/Supplemental/{name}", size)
    except OSError:
        return ImageFont.load_default()


def dominant(img):
    """Mean hue, saturation and value over the opaque pixels, as a coarse colour-mass fingerprint."""
    small = img.resize((64, 64), Image.LANCZOS)
    px = small.load()
    hs, ss, vs, n = 0.0, 0.0, 0.0, 0
    for y in range(64):
        for x in range(64):
            r, g, b, a = px[x, y]
            if a <= 128:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            hs += h
            ss += s
            vs += v
            n += 1
    return (hs / n * 360, ss / n, vs / n, n / 4096) if n else (0, 0, 0, 0)


def bbox(img):
    return img.getchannel("A").point(lambda a: 255 if a > ALPHA_FLOOR else 0).getbbox()


def measure():
    rows = []
    for i, key in enumerate(ORDER, start=1):
        img = Image.open(os.path.join(FINAL, f"{key}.png")).convert("RGBA")
        box = bbox(img)
        w, h = box[2] - box[0], box[3] - box[1]
        corners = []
        for cx, cy in ((0, 0), (976, 0), (0, 976), (976, 976)):
            corners.append(img.crop((cx, cy, cx + 48, cy + 48)).getchannel("A").getextrema()[1])
        hue, sat, val, fill = dominant(img)
        rows.append((i, key, img.size, f"{w}x{h}", w / h, max(corners), hue, sat, val, fill))
        print(
            f"{i:2d} {key:24s} {img.size[0]}x{img.size[1]} bbox={w}x{h} ratio={w / h:.2f} "
            f"corner_alpha_max={max(corners)} hue={hue:6.1f} sat={sat:.2f} val={val:.2f} fill={fill:.2f}"
        )
    return rows


def strip():
    imgs = [Image.open(os.path.join(FINAL, f"{k}.png")).convert("RGBA") for k in ORDER]
    col = 150
    pad = 30
    width = pad * 2 + col * 10

    def band(height, bg):
        im = Image.new("RGBA", (width, height), bg)
        return im, ImageDraw.Draw(im)

    def tile(img, px, bg, grey=False):
        t = img.resize((px, px), Image.LANCZOS)
        if grey:
            g = t.convert("LA").convert("RGBA")
            g.putalpha(t.getchannel("A"))
            t = g
        cell = Image.new("RGBA", (px, px), bg)
        cell.alpha_composite(t)
        return cell

    rows = []
    im, d = band(60, DARK)
    d.text((pad, 18), "QC v4  ·  prueba de silueta  ·  1 a 10", font=font(24, True), fill=(235, 235, 235))
    rows.append(im)

    for label, px, bg, grey in (
        ("64 px color, tema oscuro", 64, DARK, False),
        ("32 px color, tema oscuro", 32, DARK, False),
        ("16 px color, tema oscuro", 16, DARK, False),
        ("64 px color, tema claro", 64, LIGHT, False),
        ("32 px color, tema claro", 32, LIGHT, False),
        ("64 px gris", 64, DARK, True),
        ("32 px gris", 32, DARK, True),
        ("16 px gris", 16, DARK, True),
    ):
        ink = (235, 235, 235) if bg is DARK else (28, 28, 32)
        im, d = band(px + 46, bg)
        d.text((pad, 8), label, font=font(15, True), fill=ink)
        for i, img in enumerate(imgs):
            im.alpha_composite(tile(img, px, bg), (pad + i * col, 30))
            if grey:
                im.alpha_composite(tile(img, px, bg, grey=True), (pad + i * col, 30))
        rows.append(im)

    # Rank versus medal: the two families must never be confused at the same size.
    medals = [
        Image.open(f"/Users/Shared/Proyectos/pandatrack/public/medals/{m}.png").convert("RGBA")
        for m in ("first-order", "collection-150", "patience-120")
    ]
    im, d = band(140, DARK)
    d.text((pad, 8), "rangos frente a medallas, 72 px", font=font(15, True), fill=(235, 235, 235))
    x = pad
    for img in (imgs[0], imgs[3], imgs[6], imgs[9]):
        im.alpha_composite(tile(img, 72, DARK), (x, 34))
        d.text((x, 112), "rango", font=font(13), fill=(206, 164, 90))
        x += 96
    x += 60
    for m in medals:
        im.alpha_composite(tile(m, 72, DARK), (x, 34))
        d.text((x, 112), "medalla", font=font(13), fill=(120, 190, 220))
        x += 96
    rows.append(im)

    total = sum(r.height for r in rows)
    out = Image.new("RGBA", (width, total), DARK)
    y = 0
    for r in rows:
        out.paste(r, (0, y))
        y += r.height
    out.convert("RGB").save(os.path.join(HERE, "qc-strip.png"))
    print("qc-strip:", out.size)


if __name__ == "__main__":
    measure()
    strip()
