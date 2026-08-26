"""Blocking QC for the ten v6 rank emblems.

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


def enclosed_voids(img):
    """Transparent area the artwork encloses, i.e. daylight the silhouette wraps around.

    Reported, never repaired. On a chroma-keyed render an enclosed void is damage; on a cleanly
    delivered one it is design (rank 5's scroll spirals, the daylight under its crest arch). QC
    cannot tell those apart from a pixel count, so it surfaces the number and the human looks at
    the loud-background render.
    """
    small = img.resize((256, 256), Image.LANCZOS)
    mask = small.getchannel("A").point(lambda a: 255 if a > ALPHA_FLOOR else 0)
    for seed in ((0, 0), (255, 0), (0, 255), (255, 255)):
        if mask.getpixel(seed) == 0:
            ImageDraw.floodfill(mask, seed, 128)
    return sum(mask.point(lambda v: 255 if v == 0 else 0).histogram()[255:])


def silhouette(img, px=32):
    """Binary silhouette at thumbnail size, as a flat tuple, for neighbour comparison."""
    a = img.resize((px, px), Image.LANCZOS).getchannel("A")
    return tuple(1 if v > 96 else 0 for v in a.tobytes())


def measure():
    rows = []
    imgs = []
    for i, key in enumerate(ORDER, start=1):
        img = Image.open(os.path.join(FINAL, f"{key}.png")).convert("RGBA")
        imgs.append(img)
        box = bbox(img)
        w, h = box[2] - box[0], box[3] - box[1]
        corners = []
        for cx, cy in ((0, 0), (976, 0), (0, 976), (976, 976)):
            corners.append(img.crop((cx, cy, cx + 48, cy + 48)).getchannel("A").getextrema()[1])
        hue, sat, val, fill = dominant(img)
        voids = enclosed_voids(img)
        rows.append((i, key, img.size, f"{w}x{h}", w / h, max(corners), hue, sat, val, fill))
        print(
            f"{i:2d} {key:24s} {img.size[0]}x{img.size[1]} bbox={w}x{h} ratio={w / h:.2f} "
            f"corner_alpha_max={max(corners)} voids={voids:5d} "
            f"hue={hue:6.1f} sat={sat:.2f} val={val:.2f} fill={fill:.2f}"
        )

    # Neighbour separation. A rung only earns its place if it is not its neighbour at 32 px, so
    # compare each pair on the two axes that survive downscaling: the silhouette (IoU) and the
    # colour mass (hue plus value distance). Both being close is the failure; one being close is
    # normal and is what makes the ladder read as one family.
    print("\n   neighbour separation at 32 px (IoU 1.00 = identical silhouette)")
    for i in range(len(ORDER) - 1):
        a, b = silhouette(imgs[i]), silhouette(imgs[i + 1])
        inter = sum(1 for x, y in zip(a, b) if x and y)
        union = sum(1 for x, y in zip(a, b) if x or y)
        iou = inter / union if union else 1.0
        ha, sa, va, _ = dominant(imgs[i])
        hb, sb, vb, _ = dominant(imgs[i + 1])
        dh = min(abs(ha - hb), 360 - abs(ha - hb))
        dv = abs(va - vb)
        verdict = "OK" if (iou < 0.88 or dh > 18 or dv > 0.10) else "TOO CLOSE"
        print(
            f"   {i + 1:2d} vs {i + 2:2d}  IoU={iou:.2f}  d_hue={dh:5.1f}  d_val={dv:.2f}  {verdict}"
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
    d.text((pad, 18), "QC v6  ·  prueba de silueta  ·  1 a 10  ·  (*) = render nuevo", font=font(24, True), fill=(235, 235, 235))
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
