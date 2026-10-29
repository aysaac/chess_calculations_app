"""Step 3: pair every board image with its solution text.

Usage:
    uv run python tools/book_ocr/build_problems.py

Inputs (from steps 1-2, under tools/book_ocr/out/):
    pages/NNN.md, images/NNN_img-K.jpeg, problem_pages.json
Outputs:
    problems_analysis.json  same records, only the 96 analysis (A) positions
    problems.json   one record per board: id, kind, week, day, label, side,
                    pdf_page, image, solution (raw OCR text, may be empty)
    report.txt      counts and anything that failed to match

Layout of the book (PDF page == book page):
    problem pages   6 boards each; heading before each board, e.g.
                    "JC 1/1. 3) Juegan negras" or "A 1/2. b) Juegan blancas"
    JC solutions    pp. 199-211, "JC w/d" then "1) ...", "2) ..." per board
    A  solutions    pp. 213-257, "A w/d" then "a) ..." / "b) ..." per board
"""
import json
import re
from pathlib import Path

OUT = Path(__file__).parent / "out"

JC_SOL_PAGES = range(199, 212)
A_SOL_PAGES = range(213, 258)
FIRST_PROBLEM_PAGE = 10

PROBLEM_RE = re.compile(
    r"^[#*\s]*(JC|A) (\d+)/(\d+)\.\s*(\d\)|[a-z]\))\s*Juegan (blancas|negras)",
    re.M,
)
IMAGE_RE = re.compile(r"!\[[^\]]*\]\(([^)]+)\)")
# Page furniture: running headers and the chapter title line.
FURNITURE_RE = re.compile(
    r"^(?:#+\s*)?(?:\d+\s+)?(?:EL PROGRAMA FUERZA EN AJEDREZ|SOLUCIONES A [A-ZÁÉÍÓÚ ]+?)(?:\s+\d+)?\s*$",
    re.M,
)


def read_page(n: int) -> str:
    return FURNITURE_RE.sub("", (OUT / "pages" / f"{n:03d}.md").read_text())


def collect_problems() -> tuple[list[dict], list[str]]:
    """One record per board.

    Week/day come from the page's position (sets run in order, one per page,
    every 4 pages from p.10) rather than the printed heading: the book prints
    "9/1" on both p.138 and p.142. Headings are cross-checked and any
    disagreement is returned as a warning. OCR sometimes lists several headings
    before their images, so headings and images are zipped in order.
    """
    pages = json.loads((OUT / "problem_pages.json").read_text())
    problems, warnings = [], []
    for n in pages:
        md = (OUT / "pages" / f"{n:03d}.md").read_text()
        heads = PROBLEM_RE.findall(md)
        imgs = IMAGE_RE.findall(md)
        if len(heads) != len(imgs):
            warnings.append(f"p.{n}: {len(heads)} headings but {len(imgs)} images")
            continue
        idx = (n - FIRST_PROBLEM_PAGE) // 4
        week, day = idx // 4 + 1, idx % 4 + 1
        for (kind, w, d, label, side), img in zip(heads, imgs):
            if (int(w), int(d)) != (week, day):
                warnings.append(f"p.{n}: heading says {kind} {w}/{d}, position says {week}/{day}")
            label = label.rstrip(")")
            problems.append({
                "id": f"{kind}-{week}-{day}-{label}",
                "kind": kind,
                "week": week,
                "day": day,
                "label": label,
                "side": "white" if side == "blancas" else "black",
                "pdf_page": n,
                "image": f"images/{n:03d}_{img}",
                "solution": "",
            })
    return problems, warnings


def split_positions(text: str, kind: str) -> dict[tuple[int, int], str]:
    """Split a solutions section into {(week, day): block}.

    Headings are expected in book order (1/1, 1/2, ... 12/4). OCR sometimes
    garbles the 'A'/'JC' prefix (e.g. '♝ 8/4'), so any short token followed by
    the expected week/day counts as the next heading.
    """
    expected = [(w, d) for w in range(1, 13) for d in range(1, 5)]
    prefix = r"JC" if kind == "JC" else r"[^\s\d]{1,3}"
    blocks: dict[tuple[int, int], str] = {}
    pos = 0
    starts = []
    for w, d in expected:
        pat = re.compile(rf"^[#*\s]*{prefix}\s*{w}/{d}[*\s]*$", re.M)
        m = pat.search(text, pos)
        if m:
            starts.append(((w, d), m.start(), m.end()))
            pos = m.end()
    for i, (key, _, end) in enumerate(starts):
        stop = starts[i + 1][1] if i + 1 < len(starts) else len(text)
        blocks[key] = text[end:stop].strip()
    return blocks


def split_labels(block: str, kind: str) -> dict[str, str]:
    lab = r"[1-4]" if kind == "JC" else r"[ab]"
    parts = re.split(rf"^[#*\s]*({lab})\)\s*", block, flags=re.M)
    return {parts[i]: parts[i + 1].strip() for i in range(1, len(parts) - 1, 2)}


def main() -> None:
    problems, warnings = collect_problems()
    solutions: dict[tuple[str, int, int, str], str] = {}
    for kind, pages in (("JC", JC_SOL_PAGES), ("A", A_SOL_PAGES)):
        text = "\n".join(read_page(n) for n in pages)
        for (w, d), block in split_positions(text, kind).items():
            for label, sol in split_labels(block, kind).items():
                solutions[(kind, w, d, label)] = sol

    missing = []
    for p in problems:
        sol = solutions.get((p["kind"], p["week"], p["day"], p["label"]))
        if sol:
            p["solution"] = sol
        else:
            missing.append(p["id"])

    (OUT / "problems.json").write_text(json.dumps(problems, ensure_ascii=False, indent=1))
    analysis = [p for p in problems if p["kind"] == "A"]
    (OUT / "problems_analysis.json").write_text(json.dumps(analysis, ensure_ascii=False, indent=1))
    by_kind = {k: sum(p["kind"] == k for p in problems) for k in ("JC", "A")}
    unused = sorted(set(solutions) - {(p["kind"], p["week"], p["day"], p["label"]) for p in problems})
    report = [
        f"problems: {len(problems)} {by_kind} (expected 288 = 192 JC + 96 A)",
        f"with solution: {len(problems) - len(missing)}",
        f"no solution found ({len(missing)}): {missing}",
        f"solutions with no problem ({len(unused)}): {unused}",
        f"warnings ({len(warnings)}): {warnings}",
    ]
    (OUT / "report.txt").write_text("\n".join(report) + "\n")
    print("\n".join(report))


if __name__ == "__main__":
    main()
