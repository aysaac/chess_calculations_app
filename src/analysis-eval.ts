import type { Line, BookLine, BookEvaluation, BookLineResult } from './types';

/** Leading legal plies of a player line, as 4-char UCI (promotion piece ignored). */
function playerUci(line: Line): string[] {
  const out: string[] = [];
  for (const move of line.moves) {
    if (!move.legal) break;
    out.push(`${move.from}${move.to}`);
  }
  return out;
}

function commonPrefix(a: string[], b: string[]): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n].slice(0, 4)) n++;
  return n;
}

/**
 * Score the player's lines against the book lines. A book line is covered when
 * some player line reproduces all of its plies from the starting position.
 */
export function evaluateAgainstBook(userLines: Line[], bookLines: BookLine[]): BookEvaluation {
  const user = userLines.map(playerUci);

  const results: BookLineResult[] = bookLines.map((line) => {
    let matched = 0;
    let userLine: number | null = null;
    user.forEach((moves, idx) => {
      const n = commonPrefix(moves, line.uci);
      if (n > matched) {
        matched = n;
        userLine = idx;
      }
    });
    const status: BookLineResult['status'] =
      matched >= line.uci.length ? 'full' : matched > 0 ? 'partial' : 'none';
    return { line, matched, status, userLine };
  });

  const required = results.filter((r) => r.line.required);
  return {
    results,
    requiredTotal: required.length,
    requiredCovered: required.filter((r) => r.status === 'full').length,
  };
}
