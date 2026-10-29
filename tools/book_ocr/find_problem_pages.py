"""Step 2: list pages that contain exactly 6 board images.

Usage:
    uv run python tools/book_ocr/find_problem_pages.py [--boards 6] [--min-size 150]

Boards are figures whose bounding box is roughly square and at least
--min-size px on both sides (filters out page ornaments / stray marks).
"""
import argparse
import json
from pathlib import Path

OUT = Path(__file__).parent / "out"


def is_board(img: dict, min_size: int) -> bool:
    w = img["bottom_right_x"] - img["top_left_x"]
    h = img["bottom_right_y"] - img["top_left_y"]
    return w >= min_size and h >= min_size and 0.8 <= w / h <= 1.25


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--boards", type=int, default=6)
    ap.add_argument("--min-size", type=int, default=150)
    args = ap.parse_args()

    data = json.loads((OUT / "ocr_raw.json").read_text())
    hits = []
    for page in data["pages"]:
        boards = [i for i in page.get("images", []) if is_board(i, args.min_size)]
        if len(boards) == args.boards:
            hits.append(page["index"] + 1)
    (OUT / "problem_pages.json").write_text(json.dumps(hits))
    print(f"{len(hits)} pages with exactly {args.boards} boards:")
    print(hits)


if __name__ == "__main__":
    main()
