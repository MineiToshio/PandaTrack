#!/usr/bin/env python3
"""Deterministic post-process for medal art v2. Mandatory, never optional.

Same algorithm the rank round used, with one target changed: a medal is displayed through a
circular CSS crop, so the binding constraint is the safe RADIUS, not the bounding box.

    .venv/bin/python normalize.py raw/<key>-take<N>/<key>.png final/<key>.png

Steps
  0. Snap the near opaque matte (alpha >= 200) to fully opaque, remembering where it was soft.
  1. Despill the chroma key: inside a contour band widened DESPILL_BAND px into the artwork, plus
     anywhere the key hue dominates outright, which rule 20 guarantees is spill and never palette.
  2. Close interior alpha holes AND force the body opaque, keeping a CONTOUR_BAND px antialiased rim.
     Reports `voids` (holes bitten by the key) and `ghost` (body pixels the take left translucent).
  3. Trim to the alpha bounding box and recentre on a square canvas.
  4. Measure the true maximum radius from the centre to any opaque pixel.
  5. Scale by the SMALLER of: bbox -> TARGET_BBOX, and radius -> MAX_RADIUS.
  6. Recomposite centred on a fresh 1024x1024 RGBA canvas.
  7. Measure again and print everything. Do not eyeball any of it.
"""

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

CANVAS = 1024
# A medal is cropped to a circle by the app, so it is sized by its radius, not its box.
MAX_RADIUS = int(CANVAS * 0.5 * 0.86)  # 85 percent safe circle, with a hair of tolerance
TARGET_BBOX = int(CANVAS * 0.94)
OPAQUE_SNAP = 200
DESPILL_BAND = 4
KEY_DOMINANCE = 30
SPILL_TOLERANCE = 25
CONTOUR_BAND = 2


def flood_outside(alpha: np.ndarray, threshold: int = 8) -> np.ndarray:
    """True where a transparent pixel is reachable from the canvas border."""
    h, w = alpha.shape
    outside = np.zeros((h, w), dtype=bool)
    q: deque = deque()
    for x in range(w):
        for y in (0, h - 1):
            if alpha[y, x] <= threshold and not outside[y, x]:
                outside[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if alpha[y, x] <= threshold and not outside[y, x]:
                outside[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not outside[ny, nx] and alpha[ny, nx] <= threshold:
                outside[ny, nx] = True
                q.append((ny, nx))
    return outside


def normalize(src: Path, dst: Path) -> None:
    img = Image.open(src).convert("RGBA")
    arr = np.array(img).astype(np.int16)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]

    # 0. snap the near-opaque matte
    soft = a < 250  # remembered BEFORE the snap: these are the pixels the matte was soft on
    a[a >= OPAQUE_SNAP] = 255

    # 1. despill the contour only. The band is every pixel the matte was soft on, widened by
    #    DESPILL_BAND px into the artwork, because the generator lays a hard key-coloured fringe a
    #    couple of pixels INSIDE a contour it then reports as fully opaque.
    near_empty = a <= 8
    band = soft | near_empty
    for _ in range(DESPILL_BAND):
        grown = band.copy()
        grown[1:, :] |= band[:-1, :]
        grown[:-1, :] |= band[1:, :]
        grown[:, 1:] |= band[:, :-1]
        grown[:, :-1] |= band[:, 1:]
        band = grown
    edge = band & ~near_empty
    # Anywhere in the image, a pixel where the key hue DOMINATES is spill by construction: no medal
    # palette in this round goes anywhere near pure magenta or pure green (that is rule 20's whole
    # job). So the strong-key mask is global, and the weak-key mask is confined to the contour band.
    strong_mg = (g < r - KEY_DOMINANCE) & (g < b - KEY_DOMINANCE)
    strong_gr = (r < g - KEY_DOMINANCE) & (b < g - KEY_DOMINANCE)
    mg = (edge | strong_mg) & (g < r) & (g < b)
    gr = (edge | strong_gr) & (r < g) & (b < g)
    # Magenta lives in R and B together, so both are capped just above G; green lives in G alone, so
    # G is capped just above the brighter of R and B. A pure key pixel collapses to near neutral.
    cap_mg = g + SPILL_TOLERANCE
    cap_gr = np.maximum(r, b) + SPILL_TOLERANCE
    r[mg], b[mg] = np.minimum(r[mg], cap_mg[mg]), np.minimum(b[mg], cap_mg[mg])
    g[gr] = np.minimum(g[gr], cap_gr[gr])

    arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3] = r, g, b, a
    alpha = arr[..., 3].astype(np.uint8)

    # 2. close interior holes AND make the body genuinely opaque.
    #    Some takes come back with the whole plate sitting at alpha 40 to 200: it looks right on a
    #    dark review sheet and is a ghost on a light theme. Everything the border flood cannot reach,
    #    minus a CONTOUR_BAND px rim that keeps the real antialiasing, is set to fully opaque.
    outside = flood_outside(alpha)
    holes = (alpha <= 8) & ~outside
    voids = int(holes.sum())
    rim = outside.copy()
    for _ in range(CONTOUR_BAND):
        grown = rim.copy()
        grown[1:, :] |= rim[:-1, :]
        grown[:-1, :] |= rim[1:, :]
        grown[:, 1:] |= rim[:, :-1]
        grown[:, :-1] |= rim[:, 1:]
        rim = grown
    body = ~outside & ~rim
    ghost = int(np.count_nonzero(body & (alpha < 250)))
    arr[holes, 3] = 255
    arr[body, 3] = 255

    work = Image.fromarray(arr.astype(np.uint8), "RGBA")
    box = work.getbbox()
    if box is None:
        raise SystemExit(f"{src}: fully transparent")

    # 3. trim + recentre square
    cut = work.crop(box)
    side = max(cut.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(cut, ((side - cut.width) // 2, (side - cut.height) // 2))

    # 4. true max radius
    sa = np.array(square)[..., 3]
    ys, xs = np.nonzero(sa > 8)
    c = (side - 1) / 2
    radius = float(np.max(np.hypot(ys - c, xs - c)))

    # 5. smaller of the two scales
    s_box = TARGET_BBOX / side
    s_rad = MAX_RADIUS / radius
    scale, bound = (s_box, "bbox") if s_box <= s_rad else (s_rad, "radius")
    new_side = max(1, int(round(side * scale)))
    scaled = square.resize((new_side, new_side), Image.LANCZOS)

    # 6. recomposite
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    off = (CANVAS - new_side) // 2
    out.paste(scaled, (off, off))
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst)

    # 7. verify by measuring again
    oa = np.array(out)[..., 3]
    ys, xs = np.nonzero(oa > 8)
    bw, bh = int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)
    cc = (CANVAS - 1) / 2
    rr = float(np.max(np.hypot(ys - cc, xs - cc)))
    corners = max(
        int(oa[:48, :48].max()), int(oa[:48, -48:].max()), int(oa[-48:, :48].max()), int(oa[-48:, -48:].max())
    )
    print(
        f"{dst.name:22s} bbox={bw}x{bh} ratio={bw / bh:.2f} radius={rr:.0f}/{MAX_RADIUS} "
        f"bound={bound} voids={voids} ghost={ghost} corner_alpha={corners}"
    )


if __name__ == "__main__":
    normalize(Path(sys.argv[1]), Path(sys.argv[2]))
