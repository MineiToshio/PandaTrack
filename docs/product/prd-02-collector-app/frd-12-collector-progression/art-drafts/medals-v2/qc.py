#!/usr/bin/env python3
"""QC over the normalized medals, including the FAMILY test against the shipped ranks.

    .venv/bin/python qc.py

`gaps/row` counts, for every row with opaque pixels, the transparent runs between its first and its
last opaque pixel, averaged over those rows (measured on a 512 px resize). `split_runs/row` drops the
run containing the centre column and counts how many separate opaque runs are left per side.

A medal must stay at or under 0.15: it is ONE solid plate, and the only thing allowed to charge a gap
is the milled coin edge. Ranks 5 to 10 score 0.55 to 1.94, which is the difference this round protects.
Ranks 1 to 4 are plates too and score low as well; they are told apart from a medal by metal, field,
milled edge and motif register, not by this number.
"""

from pathlib import Path

import numpy as np
from PIL import Image

def _repo_root(start: Path) -> Path:
    """Walk up until the folder holding `public/medals`, so the scripts survive being moved."""
    for candidate in [start, *start.parents]:
        if (candidate / "public" / "medals").is_dir():
            return candidate
    raise SystemExit("repo root not found above " + str(start))


HERE = Path(__file__).resolve().parent
ROOT = _repo_root(HERE)


def metrics(path: Path) -> tuple[float, float]:
    a = np.array(Image.open(path).convert("RGBA").resize((512, 512), Image.LANCZOS))[..., 3] > 8
    gaps, splits, rows = 0, 0, 0
    for row in a:
        xs = np.nonzero(row)[0]
        if xs.size == 0:
            continue
        rows += 1
        seg = row[xs[0] : xs[-1] + 1]
        gaps += int(np.sum(seg[1:] & ~seg[:-1]))  # transparent -> opaque transitions inside the span
        padded = np.concatenate(([False], row))
        runs = int(np.sum(padded[1:] & ~padded[:-1]))  # rising edges = opaque runs on this row
        splits += max(0, runs - 1)  # minus the one run that holds the body
    if rows == 0:
        return 0.0, 0.0
    return gaps / rows, splits / rows


def report(title: str, paths: list[Path]) -> None:
    print(f"\n{title}")
    print(f"{'file':26s} {'size':10s} {'ratio':6s} {'gaps/row':9s} {'splits/row':10s} {'corners':7s}")
    for p in sorted(paths):
        img = Image.open(p).convert("RGBA")
        al = np.array(img)[..., 3]
        ys, xs = np.nonzero(al > 8)
        bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        k = min(48, al.shape[0] // 8)
        corners = max(
            int(al[:k, :k].max()), int(al[:k, -k:].max()), int(al[-k:, :k].max()), int(al[-k:, -k:].max())
        )
        g, s = metrics(p)
        print(f"{p.name:26s} {img.width}x{img.height:<5d} {bw / bh:<6.2f} {g:<9.2f} {s:<10.2f} {corners:<7d}")


if __name__ == "__main__":
    report("MEDALS v2 (must be <= 0.15: one solid plate)", list((HERE / "final").glob("*.png")))
    report("RANKS, shipped (the family they must not join)", list((ROOT / "public" / "ranks").glob("*.png")))
