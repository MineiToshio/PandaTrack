"""Two silhouette metrics, because the coarse one alone cannot tell a bird from a fan of feathers.

Run: `python3 silhouette.py final/*.png`. Written for the rank 10 review of 2026-08-25; see
`rank-art-guide.md` §7e for the numbers it produced and what was accepted on them.

`gaps_per_row` (the 1.38 measurement) counts every transparent run a row crosses between its first
and last opaque pixel. It catches split wings, but it also charges the emblem for the ordinary
concavity of a winged creature: the daylight between a drooping wing tip and the tail. Rank 7 and 8
score 0.36 and 0.30 partly because a shield fills that space, so a bird can never reach their number
without stopping being a bird.

`split_runs_per_row` isolates the defect the owner actually named. On each row it drops the run that
contains the centre column (the body/tail) and counts how many SEPARATE opaque runs are left on each
side. A wing built as one solid plate contributes exactly one run per side, so the score is 0. A wing
built as separate leaves with background between them contributes one extra run per leaf.
"""
import sys
from PIL import Image

FLOOR = 8

def runs_in_row(px, y, size):
    out, start = [], None
    for x in range(size):
        on = px[x, y] > FLOOR
        if on and start is None:
            start = x
        elif not on and start is not None:
            out.append((start, x - 1))
            start = None
    if start is not None:
        out.append((start, size - 1))
    return out

def measure(path, size=512):
    a = Image.open(path).convert("RGBA").resize((size, size), Image.LANCZOS).getchannel("A")
    px = a.load()
    c = size // 2
    rows = gaps = splits = 0
    worst_gap = worst_split = 0
    for y in range(size):
        rr = runs_in_row(px, y, size)
        if not rr or (rr[-1][1] - rr[0][0]) < 2:
            continue
        rows += 1
        g = len(rr) - 1
        gaps += g
        worst_gap = max(worst_gap, g)
        body = next((i for i, (lo, hi) in enumerate(rr) if lo <= c <= hi), None)
        if body is None:
            # No run crosses the centre: every run is off to one side, so nothing is "the body".
            left = [r for r in rr if r[1] < c]
            right = [r for r in rr if r[0] > c]
        else:
            left = rr[:body]
            right = rr[body + 1:]
        s = max(0, len(left) - 1) + max(0, len(right) - 1)
        splits += s
        worst_split = max(worst_split, s)
    return (gaps / rows, worst_gap, splits / rows, worst_split, rows) if rows else (0, 0, 0, 0, 0)

if __name__ == "__main__":
    for p in sys.argv[1:]:
        g, wg, s, ws, r = measure(p)
        print(f"{p.split('/')[-1]:26s} gaps/row={g:.2f} (worst {wg})   split_runs/row={s:.2f} (worst {ws})   rows={r}")
