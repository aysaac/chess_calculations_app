"""Step 5: build the analysis dataset the app imports (out/analysis_book.json).

Usage:
    uv run --with chess python tools/book_ocr/build_analysis_book.py [--only A-1-1-a,...]

For each analysis problem:
  1. split the solution into plans / candidates / analysis / evaluation text
  2. choose the board position: start from the hand reading and/or classifier
     reading and keep whichever makes the book's own lines legal; then greedily
     repair single squares while that reduces the number of unplaceable moves
  3. parse the analysis prose into lines (main + variations) from that position
Writes analysis_book.json and analysis_report.txt (which boards still look wrong).
"""
import itertools
import json
import re
import sys
from pathlib import Path

import chess

from bookparse import first_move_number, parse_analysis, split_sections
from boardlib import load_placements

HERE = Path(__file__).parent
OUT = HERE / "out"
PIECES = list("PNBRQKpnbrqk") + ["."]
MAX_REPAIR_ROUNDS = 5


def expand(pl: str) -> list[list[str]]:
    return [["." * 0 + ch for ch in "".join("." * int(c) if c.isdigit() else c for c in r)] for r in pl.split("/")]


def compress(grid: list[list[str]]) -> str:
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


def rights(grid: list[list[str]]) -> str:
    r = ""
    if grid[7][4] == "K":
        r += "K" if grid[7][7] == "R" else ""
        r += "Q" if grid[7][0] == "R" else ""
    if grid[0][4] == "k":
        r += "k" if grid[0][7] == "r" else ""
        r += "q" if grid[0][0] == "r" else ""
    return r or "-"


def make_board(grid, side: str, fullmove: int) -> chess.Board | None:
    placement = compress(grid)
    fen = f"{placement} {'w' if side == 'white' else 'b'} {rights(grid)} - 0 {fullmove}"
    try:
        b = chess.Board(fen)
    except ValueError:
        return None
    return b if b.is_valid() else None


def score(grid, side, fullmove, root_ply, text):
    b = make_board(grid, side, fullmove)
    if b is None:
        return None
    lines, st = parse_analysis(b, root_ply, text)
    return (st["failed"], -st["accepted"]), lines, st, b


def main() -> None:
    only = None
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
    problems = [p for p in json.loads((OUT / "problems_analysis.json").read_text())]
    hand = load_placements(HERE / "placements.txt")
    clf = load_placements(OUT / "classifier_placements.txt")
    alts = json.loads((OUT / "classifier_alts.json").read_text())

    results, report = [], []
    for p in problems:
        if only and p["id"] not in only:
            continue
        sec = split_sections(p["solution"])
        text = sec.get("Análisis", "")
        notes = []
        if not text:
            # OCR sometimes shifts the section labels (analysis ends up under a "Plan"):
            # use the section with the most move numbers.
            others = {k: v for k, v in sec.items() if k.startswith("Plan")}
            if others:
                k = max(others, key=lambda k: len(re.findall(r"\d+\s*(?:\.\.\.)?\s+\S", others[k])))
                text = others[k]
                notes.append(f"analysis taken from '{k}' section")
        # the analysis text itself is the best guide to move number and side
        fm = first_move_number(text) or first_move_number(sec.get("Jugadas candidatas", ""))
        side = p["side"]
        if fm is None:
            fullmove = 1
            notes.append("no move number found")
        else:
            fullmove, black = fm
            text_side = "black" if black else "white"
            if text_side != side:
                notes.append(f"heading says {side} to move, move numbers say {text_side}")
                side = text_side
        note = "; ".join(notes)
        root_ply = 2 * (fullmove - 1) + (1 if side == "black" else 0)

        bases = []
        if p["id"] in hand:
            bases.append(("hand", expand(hand[p["id"]])))
        bases.append(("classifier", expand(clf[p["id"]])))

        best = None  # (score, lines, stats, grid, source)

        def consider(grid, source):
            nonlocal best
            r = score(grid, side, fullmove, root_ply, text)
            if not r:
                return
            key = (r[0], 0 if source.startswith("hand") else 1)
            if best is None or key < (best[0][0], 0 if best[2].startswith("hand") else 1):
                best = (r, grid, source)

        for name, g in bases:
            consider([row[:] for row in g], name)
        # mix hand/classifier over the squares where they differ
        if len(bases) == 2:
            h, c = bases[0][1], bases[1][1]
            diff = [(r, f) for r in range(8) for f in range(8) if h[r][f] != c[r][f]]
            if 0 < len(diff) <= 10:
                for mask in itertools.product([0, 1], repeat=len(diff)):
                    g = [row[:] for row in h]
                    for (r, f), m in zip(diff, mask):
                        if m:
                            g[r][f] = c[r][f]
                    consider(g, "hand+classifier")

        # greedy single-square repair
        edits = 0
        for _ in range(MAX_REPAIR_ROUNDS):
            if best is None or best[0][0][0] == 0:
                break
            cur = best[0][0]
            improved = None
            for r in range(8):
                for f in range(8):
                    opts = PIECES
                    for ch in opts:
                        if ch == best[1][r][f]:
                            continue
                        g = [row[:] for row in best[1]]
                        g[r][f] = ch
                        res = score(g, side, fullmove, root_ply, text)
                        if res and res[0] < (improved[0][0] if improved else cur):
                            improved = (res, g)
            if not improved:
                break
            best = (improved[0], improved[1], f"{best[2]}+repair")
            edits += 1

        if best is None:
            report.append(f"{p['id']}: NO VALID POSITION")
            continue
        (sc, lines, st, board), grid, source = best
        fen = board.fen()
        out_lines = []
        for i, ln in enumerate(lines):
            out_lines.append({
                "id": f"{p['id']}-L{i + 1}",
                "depth": ln["depth"],
                "required": ln["depth"] <= 1,
                "uci": ln["moves"],
                "san": ln["san"],
            })
        results.append({
            "id": p["id"], "week": p["week"], "day": p["day"], "label": p["label"],
            "side": side, "pdfPage": p["pdf_page"], "fen": fen,
            "source": sec.get("intro", ""),
            "planWhite": sec.get("Plan de las blancas", ""),
            "planBlack": sec.get("Plan de las negras", ""),
            "candidates": sec.get("Jugadas candidatas", ""),
            "analysis": text,
            "evaluation": sec.get("Evaluación", ""),
            "lines": out_lines,
            "meta": {"fenSource": source, "failed": st["failed"], "accepted": st["accepted"],
                     "ambiguous": st["ambiguous"], "note": note,
                     "failures": st["failures"][:12]},
        })
        flag = "" if st["failed"] == 0 and not note else "  <-- CHECK"
        report.append(f"{p['id']}: {source}, lines={len(out_lines)}, accepted={st['accepted']}, "
                      f"failed={st['failed']}, ambiguous={st['ambiguous']} {note}{flag}")
        print(report[-1], flush=True)
        if "--verbose" in sys.argv:
            print("   failures:", st["failures"][:12])

    suffix = "" if not only else "_partial"
    (OUT / f"analysis_book{suffix}.json").write_text(json.dumps(results, ensure_ascii=False, indent=1))
    (OUT / f"analysis_report{suffix}.txt").write_text("\n".join(report) + "\n")


if __name__ == "__main__":
    main()
