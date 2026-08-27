"""Deterministic safe-circle normalization + QC for rank emblems.

Round 1 proved the generator cannot be trusted to hit the safe circle or the canvas
size from the prompt alone (renders came back 1536x1024 and 1254x1254). So the safe
circle is enforced here, by measurement, never by instruction.

Steps, in order:
  1. trim to the alpha bounding box
  2. recentre on a square canvas
  3. measure the TRUE maximum radius from the centre over opaque pixels
     (not the bounding-box corner, which is usually transparent and would overshrink)
  4. scale the whole subject by targetRadius / maxRadius, preserving aspect ratio
  5. recomposite centred on a fresh 1024x1024 RGBA canvas
  6. verify the measurement instead of eyeballing it
"""

import sys
from PIL import Image, ImageChops, ImageDraw

CANVAS = 1024
SAFE_DIAMETER_FRACTION = 0.90
TARGET_RADIUS = CANVAS * SAFE_DIAMETER_FRACTION / 2.0
ALPHA_FLOOR = 8
# Alpha at or above this is treated as solid subject, not matte.
SOLID_FLOOR = 200
# Only pixels below this are contour feather, and only those may be despilled.
EDGE_ALPHA_CEILING = 100


def alpha_bbox(img):
    return img.getchannel("A").point(lambda a: 255 if a > ALPHA_FLOOR else 0).getbbox()


def max_radius(img):
    """True max distance from canvas centre to any opaque pixel."""
    w, h = img.size
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    alpha = img.getchannel("A").load()
    best = 0.0
    for y in range(h):
        for x in range(w):
            if alpha[x, y] > ALPHA_FLOOR:
                d = (x - cx) ** 2 + (y - cy) ** 2
                if d > best:
                    best = d
    return best ** 0.5


def close_interior_holes(img):
    """Set back to opaque every transparent region the artwork encloses.

    The generator makes transparency by keying out a flat background color, so an enamel
    field close to that key gets bitten through. Only the transparent region CONNECTED to
    the canvas border is really background; anything else is a hole in the art. Runs before
    the bounding box is measured, since a punched hole would otherwise move the box.
    """
    w, h = img.size
    # 0 where transparent, 255 where the art is.
    mask = img.getchannel("A").point(lambda a: 255 if a > ALPHA_FLOOR else 0)
    # Flood the real background (value 0) inward from every border pixel, marking it 128.
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    seeds += [(x, 0) for x in range(0, w, 32)] + [(x, h - 1) for x in range(0, w, 32)]
    seeds += [(0, y) for y in range(0, h, 32)] + [(w - 1, y) for y in range(0, h, 32)]
    for s in seeds:
        if mask.getpixel(s) == 0:
            ImageDraw.floodfill(mask, s, 128)
    # Anything still 0 is transparent but enclosed by the art: a hole.
    holes = mask.point(lambda v: 255 if v == 0 else 0)
    hole_px = sum(holes.histogram()[255:])
    if hole_px == 0:
        return img, 0
    filled = img.copy()
    filled.putalpha(ImageChops.lighter(img.getchannel("A"), holes))
    return filled, hole_px


def solidify_alpha(img):
    """Snap a near-opaque matte to fully opaque.

    The generator's chroma-key removal returns a SOFT matte: on these renders the artwork
    body sits at alpha 250 to 254 and barely a pixel is a true 255. That is invisible on
    screen but it makes "is this pixel opaque" untestable, and it made an edge-only despill
    rewrite the entire emblem. Snap anything clearly inside the subject to 255 so the only
    partial alpha left is the real antialiased contour.
    """
    a = img.getchannel("A")
    img.putalpha(a.point(lambda v: 255 if v >= SOLID_FLOOR else v))
    return img


def despill_edges(img):
    """Pull chroma-key spill out of the antialiased contour only.

    The generator renders on a flat magenta key, so semi-transparent edge pixels keep a
    little of it and the emblem ships with a faint purple halo. Only pixels BELOW
    `EDGE_ALPHA_CEILING` are touched, which is the outer feather of the contour and nothing
    else. Without that ceiling this function strips rank 10's own magenta, which is the
    emblem's whole identity.
    """
    px = img.load()
    w, h = img.size
    touched = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0 or a >= EDGE_ALPHA_CEILING:
                continue
            m = (r + b) / 2
            if m > g:
                excess = int(m - g)
                px[x, y] = (max(0, r - excess), g, max(0, b - excess), a)
                touched += 1
    return img, touched


def normalize(src, dst):
    img = Image.open(src).convert("RGBA")
    img = solidify_alpha(img)
    img, spill = despill_edges(img)
    img, holes = close_interior_holes(img)
    box = alpha_bbox(img)
    if box is None:
        raise SystemExit(f"{src}: fully transparent")
    sub = img.crop(box)
    w, h = sub.size
    ratio = w / h

    side = max(w, h)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(sub, ((side - w) // 2, (side - h) // 2))

    # Measure on a downscaled copy for speed, then apply the factor at full size.
    probe_side = 256
    probe = square.resize((probe_side, probe_side), Image.LANCZOS)
    r_probe = max_radius(probe) / (probe_side / 2.0)  # fraction of half-side
    if r_probe <= 0:
        raise SystemExit(f"{src}: no opaque pixels")

    target_half = TARGET_RADIUS / r_probe
    new_side = max(1, int(round(target_half * 2)))
    scaled = square.resize((new_side, new_side), Image.LANCZOS)

    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    off = (CANVAS - new_side) // 2
    out.paste(scaled, (off, off))
    if new_side > CANVAS:
        out = out.crop((0, 0, CANVAS, CANVAS))
    out.save(dst)

    check = Image.open(dst).convert("RGBA")
    cbox = alpha_bbox(check)
    cw, ch = cbox[2] - cbox[0], cbox[3] - cbox[1]
    r_final = max_radius(check.resize((256, 256), Image.LANCZOS)) / 128.0 * (CANVAS / 2)
    corners = []
    for cx0, cy0 in ((0, 0), (CANVAS - 48, 0), (0, CANVAS - 48), (CANVAS - 48, CANVAS - 48)):
        region = check.crop((cx0, cy0, cx0 + 48, cy0 + 48)).getchannel("A")
        corners.append(region.getextrema()[1])

    print(
        f"{dst.split('/')[-1]:26s} src={Image.open(src).size} "
        f"raw_ratio={ratio:.2f} out_bbox={cw}x{ch} ratio={cw / ch:.2f} "
        f"radius={r_final:.0f}/{TARGET_RADIUS:.0f} holes_filled={holes} despilled={spill} corners_max_alpha={corners} "
        f"mode={check.mode}"
    )


if __name__ == "__main__":
    normalize(sys.argv[1], sys.argv[2])
