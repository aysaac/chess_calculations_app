import { Chess } from 'chess.js';
import type { Move } from './types';

/**
 * Validate a list of moves from a given FEN.
 * Returns the moves with `legal` and `san` fields populated.
 * Once the first illegal move is encountered, all subsequent moves are illegal.
 */
export function validateMoves(fen: string, moves: Move[]): Move[] {
  const chess = new Chess(fen);
  let foundIllegal = false;

  return moves.map(move => {
    if (foundIllegal) {
      return { from: move.from, to: move.to, legal: false };
    }

    try {
      const result = chess.move({ from: move.from, to: move.to });
      if (result) {
        return { from: move.from, to: move.to, san: result.san, legal: true };
      }
    } catch {
      // chess.js throws on illegal moves
    }

    foundIllegal = true;
    return { from: move.from, to: move.to, legal: false };
  });
}

/**
 * Convert UCI solution moves to SAN from a given FEN.
 */
export function solutionToSan(fen: string, uciMoves: string[]): string[] {
  const chess = new Chess(fen);
  const result: string[] = [];

  for (const uci of uciMoves) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    try {
      const move = chess.move({ from, to, promotion });
      if (move) {
        result.push(move.san);
        continue;
      }
    } catch {
      // fall through
    }
    // If we can't parse further, push remaining as UCI
    result.push(uci);
  }

  return result;
}
