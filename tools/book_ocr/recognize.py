"""Step 4a: run chessimg2pos on every analysis board image.

Usage:
    uv run --with chessimg2pos python tools/book_ocr/recognize.py [--compare]

Writes out/predicted_placements.txt ("id placement" per line). With --compare,
also scores the predictions against placements.txt (hand-read) square by square.
"""
import json
import sys
from pathlib import Path

from boardlib import crop_board, load_placements, squares
from chessimg2pos import ChessPositionPredictor, DEFAULT_CLASSIFIER, download_pretrained_model

HERE = Path(__file__).parent
OUT = HERE / "out"


def main() -> None:
    problems = json.loads((OUT / "problems_analysis.json").read_text())
    predictor = ChessPositionPredictor(
        model_path=download_pretrained_model(), classifier=DEFAULT_CLASSIFIER
    )
    predicted = {}
    (OUT / "crops").mkdir(exist_ok=True)
    for p in problems:
        try:
            crop = OUT / "crops" / f"{p['id']}.png"
            crop_board(OUT / p["image"]).save(crop)
            res = predictor.predict_chessboard(str(crop))
            predicted[p["id"]] = res["fen"].split()[0]
        except Exception as e:  # keep going; report at the end
            print(f"{p['id']}: failed ({e})")
    (OUT / "predicted_placements.txt").write_text(
        "\n".join(f"{k} {v}" for k, v in predicted.items()) + "\n"
    )
    print(f"predicted {len(predicted)}/{len(problems)} boards")

    if "--compare" in sys.argv:
        hand = load_placements(HERE / "placements.txt")
        exact = sq_ok = sq_total = 0
        for pid, hp in hand.items():
            if pid not in predicted:
                continue
            a, b = squares(hp), squares(predicted[pid])
            if len(b) != 8 or any(len(r) != 8 for r in b):
                continue
            ok = sum(x == y for ra, rb in zip(a, b) for x, y in zip(ra, rb))
            sq_ok += ok
            sq_total += 64
            exact += ok == 64
        print(f"vs hand readings: {exact}/{len(hand)} boards exact, "
              f"{sq_ok}/{sq_total} squares ({100 * sq_ok / max(sq_total, 1):.1f}%)")


if __name__ == "__main__":
    main()
