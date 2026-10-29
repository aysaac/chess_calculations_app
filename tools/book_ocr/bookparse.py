"""Parse the book's analysis prose into a tree of lines, replayed on a real board.

The text mixes prose with move notation in PGN-like style:
    "14 ♝xd5 exd5!! 15 ♞e5! (15 ♝xd5 ♛c8 ...) 15 ... ♞xe5 ..."
Parenthesised groups are alternatives; every move number tells us its ply, so
an alternative is attached at the right depth. Anything that is not a legal
move in context is treated as prose and skipped. Numbered moves that cannot be
placed are counted as failures: a wrong starting position shows up as failures.

OCR renders some rooks with the bishop glyph and some king moves with the
queen glyph, so 'B' is tried as a bishop then a rook, and 'Q'/'K' are tried
as written and then swapped. Legality decides.
"""
import re
from dataclasses import dataclass, field

import chess

# Figurine glyphs are NOT reliable in this OCR (a king glyph can stand for a
# knight, '☧' for another piece, ...). Each glyph family becomes a placeholder
# char and the piece is chosen by legality, with the glyph only ordering the guesses.
G_K, G_Q, G_R, G_B, G_N, G_X = "\ue000", "\ue001", "\ue002", "\ue003", "\ue004", "\ue005"
GLYPH = str.maketrans({
    "♔": G_K, "♚": G_K, "♕": G_Q, "♛": G_Q, "♖": G_R, "♜": G_R,
    "♗": G_B, "♝": G_B, "♘": G_N, "♞": G_N, "☧": G_X, "♑": G_X,
})
PREFER = {
    G_K: "KNQRB", G_Q: "QKNRB", G_R: "RBQNK", G_B: "BRNQK", G_N: "NKBRQ", G_X: "NBRQK",
}
PIECE_CLASS = "KQRBN" + G_K + G_Q + G_R + G_B + G_N + G_X

TOKEN = re.compile(r"""
  (?P<open>\() | (?P<close>\)) |
  (?P<result>(?<![\w/])(?:1-0|0-1|1/2-1/2)(?![\w/])) |
  (?P<castle>(?<!\w)[0O](?:-[0O]){1,2}(?!\w)[+\#]?) |
  (?P<move>(?<!\w)[""" + PIECE_CLASS + r"""]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+\#]?(?!\w)) |
  (?P<num>(?<![\w/-])\d{1,3}(?:\s*(?:\.\.\.|…))?(?![\w/-])) |
  (?P<ann>[!?+\-=∞±∓\#]+) |
  (?P<punct>[,;:.]) |
  (?P<word>[^\s()]+)
""", re.X)


@dataclass
class Ctx:
    moves: list = field(default_factory=list)   # [(san, uci)]
    boards: list = field(default_factory=list)  # boards[i] = position after i moves
    line: int | None = None                      # index into lines, None until first move
    chain: bool = False


def clone(c: Ctx) -> Ctx:
    return Ctx(list(c.moves), list(c.boards), c.line, c.chain)


def try_parse(board: chess.Board, token: str, castle: bool):
    """Return (san, move, ambiguous) or None."""
    tok = re.sub(r"[+#]", "", token)
    if castle:
        options = [tok.replace("0", "O")]
    elif tok[0] in PREFER:
        options = [letter + tok[1:] for letter in PREFER[tok[0]]]
    else:
        options = [tok]
    legal = []
    for o in options:
        try:
            mv = board.parse_san(o)
            legal.append((board.san(mv), mv))
        except ValueError:
            pass
    if not legal:
        return None
    return legal[0][0], legal[0][1], len(legal) > 1


def parse_analysis(root: chess.Board, root_ply: int, text: str):
    """Returns (lines, stats). lines: list of dicts {depth, moves:[uci], san:[..]}."""
    text = text.replace("**", "").translate(GLYPH)
    root_ctx = Ctx(boards=[root.copy()])
    ctx = root_ctx
    stack: list[Ctx] = []
    lines: list[dict] = []
    stats = {"accepted": 0, "failed": 0, "ambiguous": 0, "failures": []}
    pending = None   # (ply) of a just-seen move number
    fork = False     # next accepted move starts a new line

    def record(ctx: Ctx, depth: int):
        nonlocal fork
        if ctx.line is None or fork:
            lines.append({"depth": depth, "moves": [], "san": []})
            ctx.line = len(lines) - 1
            fork = False
        lines[ctx.line]["moves"] = [u for _, u in ctx.moves]
        lines[ctx.line]["san"] = [s for s, _ in ctx.moves]

    for m in TOKEN.finditer(text):
        kind = m.lastgroup
        tok = m.group()
        if kind == "open":
            stack.append(clone(ctx))
            ctx = clone(ctx)
            ctx.line, ctx.chain = None, True
            fork, pending = True, None
        elif kind == "close":
            if stack:
                ctx = stack.pop()
            fork, pending = False, None
            ctx.chain = False
        elif kind == "num":
            digits = re.match(r"\d+", tok).group()
            black = "." in tok or "…" in tok
            pending = 2 * (int(digits) - 1) + (1 if black else 0)
        elif kind in ("move", "castle"):
            expected = root_ply + len(ctx.moves)
            use = None
            if pending is not None:
                k = pending - root_ply
                if pending == expected:
                    use = len(ctx.moves)
                elif root_ply <= pending < expected:
                    use = k
                    fork = True
                # a gap (pending > expected) cannot be placed
            elif ctx.chain:
                if fork and ctx.moves and not stack_continues(ctx):
                    use = len(ctx.moves) - 1  # unnumbered first move after "(" = alternative
                else:
                    use = len(ctx.moves)
            if use is None:
                if pending is not None:
                    stats["failed"] += 1
                    stats["failures"].append(("unplaceable", tok, pending // 2 + 1))
                ctx.chain = False
                pending = None
                continue
            board = ctx.boards[use]
            got = try_parse(board, tok, kind == "castle")
            if got is None:
                if pending is not None:
                    stats["failed"] += 1
                    stats["failures"].append(("illegal", tok, pending // 2 + 1))
                ctx.chain = False
                pending = None
                continue
            san, mv, amb = got
            stats["ambiguous"] += amb
            stats["accepted"] += 1
            ctx.moves = ctx.moves[:use] + [(san, mv.uci())]
            nb = board.copy()
            nb.push(mv)
            ctx.boards = ctx.boards[: use + 1] + [nb]
            ctx.chain = True
            pending = None
            record(ctx, len(stack))
        elif kind in ("ann", "punct", "result"):
            if kind == "result":
                ctx.chain = False
            pending = None if kind == "result" else pending
        else:  # prose word
            ctx.chain = False
            pending = None

    seen, out = set(), []
    for ln in lines:
        key = tuple(ln["moves"])
        if ln["moves"] and key not in seen:
            seen.add(key)
            out.append(ln)
    return out, stats


def stack_continues(ctx: Ctx) -> bool:
    return False


LABELS = ["Plan de las blancas", "Plan de las negras", "Jugadas candidatas", "Análisis", "Evaluación"]
LABEL_RE = re.compile(r"(?:^|(?<=\n))\s*(?:\*\*)?\s*(" + "|".join(LABELS) + r")\s*:\s*(?:\*\*)?", re.M)


def split_sections(solution: str) -> dict[str, str]:
    """{'intro', 'Plan de las blancas', ..., 'Evaluación'} from the solution text."""
    parts = LABEL_RE.split(solution)
    out = {"intro": parts[0].strip()}
    for i in range(1, len(parts) - 1, 2):
        out[parts[i]] = parts[i + 1].strip()
    return out


def first_move_number(text: str) -> tuple[int, bool] | None:
    """First 'N' / 'N ...' marker that is followed by a move; (fullmove, black_to_move)."""
    t = text.replace("**", "").translate(GLYPH)
    m = re.search(r"(?<![\w/-])(\d{1,3})(\s*(?:\.\.\.|…))?\s+(?=[" + PIECE_CLASS + "]?[a-h]?[1-8]?x?[a-h][1-8]|[0O]-[0O])", t)
    return (int(m.group(1)), bool(m.group(2))) if m else None
