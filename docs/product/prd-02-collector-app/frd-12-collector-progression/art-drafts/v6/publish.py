"""Ship the approved v6 emblems to `public/ranks/`, the same way the medals were shipped.

Two operations and nothing else:

  1. Resize 1024 to 512. The largest slot any surface renders a rank in is `xl`, 148 CSS px, so 512
     is still more than 3x the pixels a 2x screen asks for at that size.
  2. Palette-quantize to 256 colours with FASTOCTREE, which keeps the alpha channel (the result is
     mode `P` with a transparency index, exactly what `public/medals/` holds today).

That pair took the 24 medals from ~24.5 MB to ~1.3 MB with no visible loss, and it is the reason a
rank emblem lands well under the 150 KB budget instead of shipping the megabyte-plus render.

Run: `python3 publish.py` from this folder. It prints every file's before and after size and fails
loudly if any output breaks the budget or loses its transparency.
"""

import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
FINAL = os.path.join(HERE, "final")
PUBLIC = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", "..", "..", "public", "ranks"))

# Every rank key, in ladder order. Matches `RANK_KEYS` in src/lib/data/progression/rankLadder.ts,
# which is what `resolveRankArtSrc` turns into `/ranks/<rankKey>.png`.
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


if __name__ == "__main__":
    publish()
