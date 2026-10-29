"""Shared helpers: crop a board scan to its 8x8 grid and read/write placements."""
from pathlib import Path


def crop_board(path: Path, size: int = 416):
    """Crop away the rank/file labels and return a square grayscale board.

    The scan has a blank gap between the labels and the board: a few empty
    columns after the rank digits on the left, and a few empty rows above the
    file letters at the bottom.
    """
    import numpy as np
    from PIL import Image

    im = Image.open(path).convert("L")
    a = np.asarray(im, dtype=float)
    h, w = a.shape
    colstd = a[: int(h * 0.85)].std(axis=0)
    rowstd = a[:, int(w * 0.2):].std(axis=1)

    x = 3
    while x < w // 4 and colstd[x] >= 8:  # skip the rank digits
        x += 1
    while x < w // 4 and colstd[x] < 8:  # skip the gap
        x += 1
    left = x

    y = h - 1
    while y > h * 0.75 and rowstd[y] >= 12:  # skip the file letters
        y -= 1
    while y > h * 0.75 and rowstd[y] < 12:  # skip the gap
        y -= 1
    bottom = y + 1

    board = im.crop((left, 0, w, bottom))
    return board.resize((size, size), Image.LANCZOS).convert("RGB")


def expand(row: str) -> str:
    return "".join("." * int(c) if c.isdigit() else c for c in row)


def squares(placement: str) -> list[str]:
    return [expand(r) for r in placement.split("/")]


def load_placements(path: Path) -> dict[str, str]:
    out = {}
    for line in path.read_text().splitlines():
        if line and not line.startswith("#"):
            pid, pl = line.split()
            out[pid] = pl
    return out
