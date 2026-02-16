import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import type { Move } from './types';

let cg: Api | null = null;
let currentFen: string = '';
let onMoveInput: ((from: Key, to: Key) => void) | null = null;

export function setOnMoveInput(cb: (from: Key, to: Key) => void) {
  onMoveInput = cb;
}

export function initBoard(element: HTMLElement, fen: string, orientation: 'white' | 'black'): Api {
  currentFen = fen;
  cg = Chessground(element, {
    fen,
    orientation,
    coordinates: true,
    movable: {
      free: true,
      color: 'both',
      events: {
        after(orig: Key, dest: Key) {
          // Capture the move, then reset the board to the original position
          if (onMoveInput) onMoveInput(orig, dest);
          resetPosition();
        },
      },
    },
    draggable: {
      enabled: true,
      showGhost: true,
    },
    selectable: {
      enabled: true,
    },
    highlight: {
      lastMove: false,
    },
    drawable: {
      enabled: false,
      visible: true,
      autoShapes: [],
    },
  });
  return cg;
}

function resetPosition() {
  if (!cg) return;
  // Snap pieces back to the original puzzle position without clearing arrows
  cg.set({
    fen: currentFen,
    lastMove: undefined,
    movable: {
      free: true,
      color: 'both',
    },
  });
}

export function getApi(): Api | null {
  return cg;
}

export function setPosition(fen: string, orientation: 'white' | 'black') {
  currentFen = fen;
  if (!cg) return;
  cg.set({
    fen,
    orientation,
    drawable: { autoShapes: [] },
  });
}

export function drawArrows(moves: Move[]) {
  if (!cg) return;
  const shapes: DrawShape[] = moves.map((move, i) => ({
    orig: move.from,
    dest: move.to,
    brush: i % 2 === 0 ? 'green' : 'red',
  }));
  cg.setAutoShapes(shapes);
}

export function clearArrows() {
  if (!cg) return;
  cg.setAutoShapes([]);
}

export function setInputEnabled(enabled: boolean) {
  if (!cg) return;
  cg.set({
    movable: {
      free: enabled,
      color: enabled ? 'both' : undefined,
    },
    draggable: {
      enabled,
    },
    selectable: {
      enabled,
    },
  });
  if (!enabled) {
    cg.selectSquare(null);
  }
}
