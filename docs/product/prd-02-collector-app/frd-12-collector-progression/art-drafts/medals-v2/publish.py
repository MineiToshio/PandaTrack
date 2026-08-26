"""Ship the approved v2 medal album to `public/medals/`, the same way the ranks were shipped.

Two operations and nothing else:

  1. Resize 1024 to 512. The largest slot any surface renders a medal in is the detail stage, well
     under 256 CSS px, so 512 still covers a 2x screen with room over.
  2. Palette-quantize to 256 colours with FASTOCTREE, which keeps the alpha channel (the result is
     mode `P` with a transparency index, exactly what `public/medals/` held before this round).

Run: `.venv/bin/python publish.py` from this folder. It prints every file's before and after size,
fails loudly if any output breaks the 150 KB budget or loses its transparency, and reports any file
already in `public/medals/` that no medal key claims any more.
"""

import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
FINAL = os.path.join(HERE, "final")
PUBLIC = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", "..", "..", "public", "medals"))

# Every medal key, grouped by series in catalogue order. Matches `MEDAL_CATALOGUE` in
# src/lib/data/progression/medalCatalogue.ts, whose `imageKey` resolves to `/medals/<key>.png`.
ORDER = [
    "first-order",
    "first-payment",
    "first-arrival",
    "first-order-closed",
    "first-review",
    "first-photo-order",
    "first-store",
    "first-preorder",
    "patience-60",
    "patience-120",
    "patience-200",
    "split-arrival",
    "collection-10",
    "collection-50",
    "collection-150",
    "arrivals-25",
    "variety-3",
    "countries-3",
    "variety-6",
    "stores-10",
    "clean-record-1",
    "store-charted-1",
    "reviews-5",
    "clean-record-10",
    "midnight-order",
    "swift-arrival",
    "same-day-settle",
    "year-streak",
]

SIDE = 512
COLORS = 256
BUDGET_BYTES = 150 * 1024


def publish():
    os.makedirs(PUBLIC, exist_ok=True)
    worst = 0
    for key in ORDER:
        src = os.path.join(FINAL, f"{key}.png")
        dst = os.path.join(PUBLIC, f"{key}.png")
        before = os.path.getsize(src)
        img = Image.open(src).convert("RGBA").resize((SIDE, SIDE), Image.LANCZOS)
        img.quantize(colors=COLORS, method=Image.Quantize.FASTOCTREE).save(dst, optimize=True)

        after = os.path.getsize(dst)
        worst = max(worst, after)
        check = Image.open(dst)
        transparent = check.info.get("transparency") is not None or check.mode == "RGBA"
        assert check.size == (SIDE, SIDE), f"{key}: {check.size}"
        assert transparent, f"{key}: lost its transparency"
        assert after <= BUDGET_BYTES, f"{key}: {after} bytes is over the 150 KB budget"
        print(f"{key:26s} {before / 1024:8.0f} KB -> {after / 1024:6.1f} KB  mode={check.mode}")
    print(f"largest: {worst / 1024:.1f} KB   folder: {PUBLIC}")

    claimed = {f"{key}.png" for key in ORDER}
    orphans = sorted(f for f in os.listdir(PUBLIC) if f.endswith(".png") and f not in claimed)
    if orphans:
        print("orphans no medal key claims: " + ", ".join(orphans))
    else:
        print("no orphans")


if __name__ == "__main__":
    publish()
