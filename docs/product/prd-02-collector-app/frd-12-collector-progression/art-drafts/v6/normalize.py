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

v6 changes, because the five replacement renders came from a different generator:

  a. Flat backgrounds are cut to alpha only when there IS one. The v5 generator delivered
     a magenta key; this batch already arrives with real transparency. `cut_flat_matte`
     measures the border before it touches anything and no-ops when the border is already
     transparent, so a render that is already keyed is never re-keyed.
  b. Despill is now conditional on measuring spill, not assumed. The v5 despill pulls red
     and blue out of the contour feather; run unconditionally on this batch it would eat
     the amethyst contour of rank 10, which is the emblem's identity. `spill_score`
     decides, and the decision is printed.
  c. The safe-circle CAP can be waived per file (`--no-cap`), because the cap is what made
     v5 ranks 4, 5 and 10 ship visibly smaller (682, 681 and 803 px boxes against the 890
     the other seven hit). The cap exists to stop an extremity leaving the canvas; when the
     extremity is a diagonal corner of an otherwise square footprint, honouring it breaks
     the thing it was meant to protect, which is one consistent apparent size across the
     ladder.
"""

import sys
from PIL import Image, ImageChops, ImageDraw

CANVAS = 1024
# v3 normalizes the FOOTPRINT, not the radius.
#
# v2 scaled every emblem until its farthest opaque pixel sat on a 90 percent circle. That is correct
# for a disc, whose bounding box is exactly twice its radius, and wrong for everything else: a winged
# crest reaches that circle on two diagonals while its bounding box is still 25 percent smaller, so
# the airy top ranks rendered visibly smaller than the plain bottom ones. Measured on the v3 batch
# before this change: rank 1 came out 920 px wide and rank 10 came out 722 px, on the same target.
#
# So the target is the bounding box, and the safe circle becomes a CAP rather than the goal: scale to
# TARGET_BBOX unless that would push an extremity past MAX_RADIUS, in which case the cap wins.
TARGET_BBOX = 890.0
SAFE_DIAMETER_FRACTION = 0.99
MAX_RADIUS = CANVAS * SAFE_DIAMETER_FRACTION / 2.0
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


def cut_flat_matte(img):
    """Key a flat opaque background to alpha, but only when the render actually has one.

    ChatGPT hands emblems back either already keyed or sitting on a flat white card. Cutting a
    white card with a plain luminance threshold would also punch through the emblem's own
    highlights (the ice crystal of rank 1 and the incandescent core of rank 10 are near white),
    so the cut is a FLOOD from the border, not a global threshold: a pixel is background only if
    it is within tolerance of the border colour AND connected to the border. A white glint fenced
    in by dark metal is never reached, which is the whole point.

    Returns (img, cut_pixels). cut_pixels == -1 means there was nothing to cut.
    """
    w, h = img.size
    a = img.getchannel("A")
    border = [a.getpixel((x, 0)) for x in range(0, w, 8)] + [a.getpixel((x, h - 1)) for x in range(0, w, 8)]
    border += [a.getpixel((0, y)) for y in range(0, h, 8)] + [a.getpixel((w - 1, y)) for y in range(0, h, 8)]
    if max(border) <= ALPHA_FLOOR:
        return img, -1  # already transparent, leave it alone

    rgb = img.convert("RGB")
    px = rgb.load()
    samples = [px[x, 0] for x in range(0, w, 8)] + [px[x, h - 1] for x in range(0, w, 8)]
    n = len(samples)
    key = tuple(sum(s[i] for s in samples) // n for i in range(3))
    tol = 26

    # 255 = candidate background (within tolerance of the key), 0 = subject.
    cand = Image.new("L", (w, h), 0)
    cp = cand.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if abs(r - key[0]) <= tol and abs(g - key[1]) <= tol and abs(b - key[2]) <= tol:
                cp[x, y] = 255
    # Only the candidate region CONNECTED to the border is background.
    reached = Image.new("L", (w, h), 0)
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if cand.getpixel(seed) == 255:
            ImageDraw.floodfill(cand, seed, 128)
    for y in range(h):
        for x in range(w):
            if cp[x, y] == 128:
                reached.putpixel((x, y), 255)
    cut = sum(reached.histogram()[255:])
    out = img.copy()
    out.putalpha(ImageChops.subtract(img.getchannel("A"), reached))
    return out, cut


def spill_score(img):
    """Mean magenta excess over the contour feather, as the evidence for despilling or not.

    v5 despilled every render because every render came off a magenta key. Assuming that here
    is destructive: rank 10 is amethyst, so its own contour is legitimately magenta-leaning and
    an unconditional despill desaturates the emblem's identity colour. So measure first. A real
    chroma key leaves a feather that is magenta AND much brighter than the artwork behind it;
    a purple emblem leaves a feather that is magenta and dark.
    """
    px = img.load()
    w, h = img.size
    total, count, bright = 0.0, 0, 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b, a = px[x, y]
            if a == 0 or a >= EDGE_ALPHA_CEILING:
                continue
            m = (r + b) / 2
            total += max(0.0, m - g)
            count += 1
            if m - g > 60 and m > 170:
                bright += 1
    if not count:
        return 0.0, 0.0
    return total / count, bright / count


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


def normalize(src, dst, allow_cap=True):
    img = Image.open(src).convert("RGBA")
    img, cut = cut_flat_matte(img)
    img = solidify_alpha(img)
    spill_mean, spill_bright = spill_score(img)
    # Two conditions, because either alone gives a false positive: a magenta-leaning feather is
    # normal on an amethyst emblem, and a bright feather is normal on any light rim.
    do_despill = spill_mean > 24 and spill_bright > 0.15
    spill = 0
    if do_despill:
        img, spill = despill_edges(img)
    # Hole filling is repair work for a chroma key that bit through an enamel field close to the
    # key colour. It is only ever correct when a key was actually removed. Run unconditionally on
    # this batch it does the opposite of its job: rank 5's scroll spirals and the daylight under
    # its crest arch are DESIGNED voids, and filling them paints 19k pixels of undefined RGB into
    # the middle of the artwork. So detect always, report always, fill only on evidence.
    _, holes = close_interior_holes(img)
    filled = 0
    if cut >= 0 and holes:
        img, filled = close_interior_holes(img)
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

    # Two candidate scales, and the smaller one wins: hit the footprint target, unless the safe
    # circle would be breached first.
    scale_bbox = TARGET_BBOX / side
    scale_cap = (MAX_RADIUS * 2) / (r_probe * side)
    scale = min(scale_bbox, scale_cap) if allow_cap else scale_bbox
    capped = allow_cap and scale_cap < scale_bbox
    new_side = max(1, int(round(side * scale)))
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
    limit = "radius" if capped else "bbox"
    corners = []
    for cx0, cy0 in ((0, 0), (CANVAS - 48, 0), (0, CANVAS - 48), (CANVAS - 48, CANVAS - 48)):
        region = check.crop((cx0, cy0, cx0 + 48, cy0 + 48)).getchannel("A")
        corners.append(region.getextrema()[1])

    matte = "already-alpha" if cut < 0 else f"cut={cut}"
    print(
        f"{dst.split('/')[-1]:26s} src={Image.open(src).size} "
        f"raw_ratio={ratio:.2f} out_bbox={cw}x{ch} ratio={cw / ch:.2f} "
        f"radius={r_final:.0f}/{MAX_RADIUS:.0f} limited_by={limit} matte={matte} "
        f"holes_seen={holes} holes_filled={filled} spill={spill_mean:.1f}/{spill_bright:.2f} despilled={spill} "
        f"corners_max_alpha={corners} mode={check.mode}"
    )


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--no-cap"]
    normalize(args[0], args[1], allow_cap="--no-cap" not in sys.argv)
