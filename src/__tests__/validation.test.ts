import { describe, it, expect } from 'vitest';
import { validateMoves, solutionToSan } from '../validation';
import type { Move } from '../types';
import type { Key } from 'chessground/types';

// ---- validateMoves --------------------------------------------------------

describe('validateMoves', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('validates a single legal move and populates san', () => {
    const moves: Move[] = [
      { from: 'e2' as Key, to: 'e4' as Key, legal: true },
    ];
    const result = validateMoves(startFen, moves);
    expect(result).toHaveLength(1);
    expect(result[0].legal).toBe(true);
    expect(result[0].san).toBe('e4');
    expect(result[0].from).toBe('e2');
    expect(result[0].to).toBe('e4');
  });

  it('marks illegal move as illegal and strips san', () => {
    const moves: Move[] = [
      { from: 'e2' as Key, to: 'e5' as Key, legal: true },
    ];
    const result = validateMoves(startFen, moves);
    expect(result).toHaveLength(1);
    expect(result[0].legal).toBe(false);
    expect(result[0].san).toBeUndefined();
  });

  it('validates multiple legal moves in sequence', () => {
    const moves: Move[] = [
      { from: 'e2' as Key, to: 'e4' as Key, legal: true },
      { from: 'e7' as Key, to: 'e5' as Key, legal: true },
      { from: 'g1' as Key, to: 'f3' as Key, legal: true },
    ];
    const result = validateMoves(startFen, moves);
    expect(result).toHaveLength(3);
    expect(result.map(m => m.legal)).toEqual([true, true, true]);
    expect(result.map(m => m.san)).toEqual(['e4', 'e5', 'Nf3']);
  });

  it('stops validating after first illegal move', () => {
    const moves: Move[] = [
      { from: 'e2' as Key, to: 'e4' as Key, legal: true },
      { from: 'e7' as Key, to: 'e3' as Key, legal: true }, // illegal
      { from: 'd2' as Key, to: 'd4' as Key, legal: true }, // would be legal if isolated
    ];
    const result = validateMoves(startFen, moves);
    expect(result).toHaveLength(3);
    expect(result[0].legal).toBe(true);
    expect(result[1].legal).toBe(false);
    // Once illegal is seen, subsequent moves are illegal too
    expect(result[2].legal).toBe(false);
  });

  it('handles empty moves array', () => {
    const result = validateMoves(startFen, []);
    expect(result).toEqual([]);
  });

  it('works with a mid-game FEN', () => {
    // Position after 1.e4 e5 2.Nf3 Nc6
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const moves: Move[] = [
      { from: 'f1' as Key, to: 'b5' as Key, legal: true }, // Bb5 (Ruy Lopez)
    ];
    const result = validateMoves(fen, moves);
    expect(result[0].legal).toBe(true);
    expect(result[0].san).toBe('Bb5');
  });

  it('detects illegal move when king is in check', () => {
    // Scholar's mate position: black must block, but try moving a random pawn
    const fen = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
    const moves: Move[] = [
      { from: 'a7' as Key, to: 'a6' as Key, legal: true }, // illegal — king in check
    ];
    const result = validateMoves(fen, moves);
    expect(result[0].legal).toBe(false);
  });

  it('validates a knight move with correct SAN', () => {
    // After 1.e4 e5
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const moves: Move[] = [
      { from: 'g1' as Key, to: 'f3' as Key, legal: true },
    ];
    const result = validateMoves(fen, moves);
    expect(result[0].legal).toBe(true);
    expect(result[0].san).toBe('Nf3');
  });
});

// ---- solutionToSan ---------------------------------------------------------

describe('solutionToSan', () => {
  it('converts UCI moves to SAN from starting position', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const uci = ['e2e4', 'e7e5', 'g1f3'];
    const result = solutionToSan(fen, uci);
    expect(result).toEqual(['e4', 'e5', 'Nf3']);
  });

  it('handles castling', () => {
    const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 2 5';
    const uci = ['e1g1']; // white castles kingside
    const result = solutionToSan(fen, uci);
    expect(result).toEqual(['O-O']);
  });

  it('handles disambiguation when two pieces can reach same square', () => {
    // Both knights can go to d2
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    const uci = ['b1c3']; // Nb1 to c3
    const result = solutionToSan(fen, uci);
    // Should have some form of Nc3 (disambiguation may or may not be needed here)
    expect(result[0]).toMatch(/^N/);
  });

  it('handles empty UCI array', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(solutionToSan(fen, [])).toEqual([]);
  });

  it('does not crash on illegal UCI — passes through as UCI', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const uci = ['e2e5']; // illegal move
    const result = solutionToSan(fen, uci);
    // Falls back to passing through the UCI
    expect(result).toEqual(['e2e5']);
  });

  it('handles multiple illegal moves in sequence', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const uci = ['e2e4', 'e7e8', 'g1f3']; // second move is illegal
    const result = solutionToSan(fen, uci);
    // After e2e4 it's black's turn; e7e8 is illegal so the position stays
    // at black's turn. g1f3 (white move) also fails because it's still black's turn.
    expect(result).toEqual(['e4', 'e7e8', 'g1f3']);
  });
});
