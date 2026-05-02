import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Key } from 'chessground/types';

// Mock board module — we only care that drawArrows / resetToInitial / replayMoves
// / animateMove are called, not what they actually do
vi.mock('../board', () => ({
  drawArrows: vi.fn(),
  resetToInitial: vi.fn(),
  replayMoves: vi.fn(),
  animateMove: vi.fn(),
}));

// Mock validation module — return legal moves with generated SAN
vi.mock('../validation', () => ({
  validateMoves: vi.fn((_fen: string, moves: { from: string; to: string; legal: boolean }[]) =>
    moves.map((m, i) => ({
      ...m,
      legal: true,
      san: `${m.from}${m.to}`,
    }))
  ),
}));

import {
  setPuzzleFen,
  setOnChange,
  addMove,
  undo,
  newLine,
  finish,
  reset,
  getCurrentLine,
  getCompletedLines,
} from '../lines';
import * as board from '../board';
import * as validation from '../validation';

function K(s: string): Key {
  return s as Key;
}

describe('lines', () => {
  beforeEach(() => {
    // Reset module state by calling reset
    reset();
    setPuzzleFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    vi.clearAllMocks();
  });

  describe('addMove', () => {
    it('adds a move to the current line', () => {
      addMove(K('e2'), K('e4'));
      expect(getCurrentLine()).toHaveLength(1);
      expect(getCurrentLine()[0]).toMatchObject({ from: 'e2', to: 'e4' });
    });

    it('calls animateMove', () => {
      addMove(K('e2'), K('e4'));
      expect(board.animateMove).toHaveBeenCalledWith('e2', 'e4');
    });

    it('calls drawArrows with current line', () => {
      addMove(K('e2'), K('e4'));
      expect(board.drawArrows).toHaveBeenCalledWith(getCurrentLine());
    });

    it('calls validateMoves to revalidate the line', () => {
      addMove(K('e2'), K('e4'));
      addMove(K('e7'), K('e5'));
      expect(validation.validateMoves).toHaveBeenCalledTimes(2);
    });

    it('notifies onChange callback', () => {
      const cb = vi.fn();
      setOnChange(cb);
      addMove(K('e2'), K('e4'));
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('builds up multiple moves in the current line', () => {
      addMove(K('e2'), K('e4'));
      addMove(K('e7'), K('e5'));
      addMove(K('g1'), K('f3'));
      expect(getCurrentLine()).toHaveLength(3);
    });
  });

  describe('undo', () => {
    it('removes the last move from the current line', () => {
      addMove(K('e2'), K('e4'));
      addMove(K('e7'), K('e5'));
      undo();
      expect(getCurrentLine()).toHaveLength(1);
    });

    it('calls replayMoves after undo', () => {
      addMove(K('e2'), K('e4'));
      addMove(K('e7'), K('e5'));
      undo();
      expect(board.replayMoves).toHaveBeenCalled();
    });

    it('does nothing when line is empty', () => {
      undo();
      expect(getCurrentLine()).toHaveLength(0);
      expect(board.replayMoves).not.toHaveBeenCalled();
    });

    it('can undo back to empty line', () => {
      addMove(K('e2'), K('e4'));
      undo();
      expect(getCurrentLine()).toHaveLength(0);
    });
  });

  describe('newLine', () => {
    it('moves current line to completed lines', () => {
      addMove(K('e2'), K('e4'));
      addMove(K('e7'), K('e5'));
      newLine();

      expect(getCompletedLines()).toHaveLength(1);
      expect(getCompletedLines()[0].moves).toHaveLength(2);
      expect(getCurrentLine()).toHaveLength(0);
    });

    it('resets the board to initial position', () => {
      addMove(K('e2'), K('e4'));
      newLine();
      expect(board.resetToInitial).toHaveBeenCalled();
    });

    it('clears arrows after newLine', () => {
      addMove(K('e2'), K('e4'));
      newLine();
      expect(board.drawArrows).toHaveBeenCalledWith([]);
    });

    it('does nothing when current line is empty', () => {
      newLine();
      expect(getCompletedLines()).toHaveLength(0);
      expect(board.resetToInitial).not.toHaveBeenCalled();
    });

    it('supports multiple lines being saved', () => {
      addMove(K('e2'), K('e4'));
      newLine();
      addMove(K('d2'), K('d4'));
      newLine();
      addMove(K('g1'), K('f3'));

      expect(getCompletedLines()).toHaveLength(2);
      expect(getCurrentLine()).toHaveLength(1);
    });
  });

  describe('finish', () => {
    it('returns current and completed lines without modifying state', () => {
      addMove(K('e2'), K('e4'));
      newLine();
      addMove(K('d2'), K('d4'));
      addMove(K('d7'), K('d5'));

      const result = finish();

      expect(result.completedLines).toHaveLength(1);
      expect(result.currentLine).toHaveLength(2);
      // State should still be intact
      expect(getCompletedLines()).toHaveLength(1);
      expect(getCurrentLine()).toHaveLength(2);
    });
  });

  describe('reset', () => {
    it('clears all lines', () => {
      addMove(K('e2'), K('e4'));
      newLine();
      addMove(K('d2'), K('d4'));

      reset();

      expect(getCurrentLine()).toHaveLength(0);
      expect(getCompletedLines()).toHaveLength(0);
    });

    it('clears arrows', () => {
      addMove(K('e2'), K('e4'));
      reset();
      expect(board.drawArrows).toHaveBeenCalledWith([]);
    });

    it('notifies onChange', () => {
      const cb = vi.fn();
      setOnChange(cb);

      // clear the call from addMove
      addMove(K('e2'), K('e4'));
      cb.mockClear();

      reset();
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });
});
