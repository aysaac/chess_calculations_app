"""Step 4b: train a per-square piece classifier on this book's own diagrams.

Usage:
    uv run --with scikit-learn --with numpy --with pillow python tools/book_ocr/train_classifier.py

Trains on the boards listed in placements.txt (hand-read), then:
  * prints board-grouped cross-validation accuracy
  * writes out/classifier_placements.txt: a prediction for EVERY board, from a
    model trained on all other boards (leave-fold-out), so disagreements with
    placements.txt point at either a classifier miss or a hand-reading error
  * writes out/disagreements.txt listing every square where they differ
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from sklearn.model_selection import GroupKFold
from sklearn.svm import SVC

from boardlib import crop_board, load_placements, squares

HERE = Path(__file__).parent
OUT = HERE / "out"
SIZE = 416
CELL = SIZE // 8
T = 24  # feature tile size
rng = np.random.default_rng(0)
FILES = "abcdefgh"


def tile_feature(board: np.ndarray, r: int, c: int, dy: int = 0, dx: int = 0) -> np.ndarray:
    y0, x0 = r * CELL + dy, c * CELL + dx
    pad = np.pad(board, CELL, mode="edge")
    t = pad[y0 + CELL : y0 + 2 * CELL, x0 + CELL : x0 + 2 * CELL]
    im = Image.fromarray(t.astype(np.uint8)).resize((T, T), Image.LANCZOS)
    v = np.asarray(im, dtype=np.float32).ravel() / 255.0
    return (v - v.mean()) / (v.std() + 1e-6)


def board_array(pid: str, images: dict[str, str]) -> np.ndarray:
    return np.asarray(crop_board(OUT / images[pid], SIZE).convert("L"), dtype=np.float32)


def build(pids, images, labels, augment: bool):
    X, y, g = [], [], []
    for gi, pid in enumerate(pids):
        arr = board_array(pid, images)
        grid = squares(labels[pid]) if pid in labels else None
        shifts = [(0, 0)] + ([(int(a), int(b)) for a, b in rng.integers(-4, 5, size=(4, 2))] if augment else [])
        for r in range(8):
            for c in range(8):
                for dy, dx in shifts:
                    X.append(tile_feature(arr, r, c, dy, dx))
                    y.append(grid[r][c] if grid else "?")
                    g.append(gi)
    return np.array(X), np.array(y), np.array(g)


def top3(clf, Xb):
    d = clf.decision_function(Xb)
    out = []
    for row in d:
        idx = np.argsort(row)[::-1][:3]
        out.append([[str(clf.classes_[i]), float(row[i])] for i in idx])
    return out


def main() -> None:
    problems = json.loads((OUT / "problems_analysis.json").read_text())
    images = {p["id"]: p["image"] for p in problems}
    labels = load_placements(HERE / "placements.txt")
    all_ids = [p["id"] for p in problems]
    train_ids = [i for i in all_ids if i in labels]

    X, y, g = build(train_ids, images, labels, augment=True)
    print(f"training tiles: {len(y)} from {len(train_ids)} boards")

    alts = {}  # pid -> 64 x [(class, score) x3]
    preds = {}  # pid -> 8x8 chars, each from a model that did not train on that board
    folds = GroupKFold(n_splits=6)
    gb = np.array([train_ids[i] for i in g])
    for k, (tr, te) in enumerate(folds.split(X, y, g)):
        clf = SVC(C=10, gamma="scale", decision_function_shape="ovr").fit(X[tr], y[tr])
        for pid in sorted(set(gb[te])):
            Xb, _, _ = build([pid], images, labels, augment=False)
            preds[pid] = clf.predict(Xb).reshape(8, 8)
            alts[pid] = top3(clf, Xb)
        print(f"fold {k + 1}/6 done")

    final = SVC(C=10, gamma="scale", decision_function_shape="ovr").fit(X, y)
    for pid in all_ids:
        if pid not in preds:
            Xb, _, _ = build([pid], images, labels, augment=False)
            preds[pid] = final.predict(Xb).reshape(8, 8)
            alts[pid] = top3(final, Xb)
    (OUT / "classifier_alts.json").write_text(json.dumps(alts))

    def to_placement(grid) -> str:
        rows = []
        for row in grid:
            s, n = "", 0
            for ch in row:
                if ch == ".":
                    n += 1
                else:
                    s += (str(n) if n else "") + ch
                    n = 0
            rows.append(s + (str(n) if n else ""))
        return "/".join(rows)

    (OUT / "classifier_placements.txt").write_text(
        "\n".join(f"{pid} {to_placement(preds[pid])}" for pid in all_ids) + "\n"
    )

    exact = bad = total = 0
    lines = []
    for pid in train_ids:
        hand = squares(labels[pid])
        diffs = []
        for r in range(8):
            for c in range(8):
                total += 1
                if hand[r][c] != preds[pid][r][c]:
                    bad += 1
                    diffs.append(f"{FILES[c]}{8 - r}: hand={hand[r][c]} clf={preds[pid][r][c]}")
        exact += not diffs
        if diffs:
            lines.append(f"{pid}: " + "; ".join(diffs))
    (OUT / "disagreements.txt").write_text("\n".join(lines) + "\n")
    print(f"leave-board-out: {exact}/{len(train_ids)} boards exact, "
          f"{total - bad}/{total} squares ({100 * (total - bad) / total:.2f}%)")
    print(f"{len(lines)} boards have disagreements -> out/disagreements.txt")


if __name__ == "__main__":
    main()
