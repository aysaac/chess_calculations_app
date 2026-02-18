import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import type { Move } from './types';
import { getArrowVisibility, getArrowColorMode, getBoardVisibility } from './settings';

let cg: Api | null = null;
let currentFen: string = '';
let lastDrawnMoves: Move[] = [];
let onMoveInput: ((from: Key, to: Key) => void) | null = null;
let resizeObserver: ResizeObserver | null = null;

export function setOnMoveInput(cb: (from: Key, to: Key) => void) {
  onMoveInput = cb;
}

export function initBoard(element: HTMLElement, fen: string, orientation: 'white' | 'black'): Api {
  currentFen = fen;
  const isDynamic = getBoardVisibility() === 'dynamic';

  // Toggle CSS class to hide drag visuals in static mode
  element.classList.toggle('static-board', !isDynamic);

  cg = Chessground(element, {
    fen,
    orientation,
    coordinates: true,
    movable: {
      free: true,
      color: 'both',
      events: {
        after(orig: Key, dest: Key) {
          if (onMoveInput) onMoveInput(orig, dest);
          if (getBoardVisibility() === 'static') {
            resetPosition();
          } else {
            reEnableMovement();
          }
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
    animation: {
      enabled: isDynamic,
    },
    drawable: {
      enabled: false,
      visible: true,
      autoShapes: [],
    },
  });

  // Make the board resizable — keep it square and sync chessground
  if (resizeObserver) resizeObserver.disconnect();
  resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const size = Math.round(Math.min(entry.contentRect.width, entry.contentRect.height));
      if (size < 200) continue;
      const wrap = element.querySelector('.cg-wrap') as HTMLElement;
      if (wrap) {
        wrap.style.width = `${size}px`;
        wrap.style.height = `${size}px`;
      }
      element.style.width = `${size}px`;
      element.style.height = `${size}px`;
      cg?.redrawAll();
    }
  });
  resizeObserver.observe(element);

  return cg;
}

function resetPosition() {
  if (!cg) return;
  cg.set({
    fen: currentFen,
    lastMove: undefined,
    movable: {
      free: true,
      color: 'both',
    },
  });
}

function reEnableMovement() {
  if (!cg) return;
  cg.set({
    lastMove: undefined,
    movable: {
      free: true,
      color: 'both',
    },
  });
}

export function resetToInitial() {
  resetPosition();
}

export function replayMoves(moves: Move[]) {
  if (!cg) return;
  if (getBoardVisibility() === 'static') return;
  // Reset to initial position then replay each move visually
  resetPosition();
  for (const move of moves) {
    cg.move(move.from, move.to);
  }
  reEnableMovement();
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
  lastDrawnMoves = moves;
  renderArrows();
}

export function drawCurrentArrows() {
  renderArrows();
}

function renderArrows() {
  if (!cg) return;

  const moves = lastDrawnMoves;
  const visibility = getArrowVisibility();
  const colorMode = getArrowColorMode();

  if (visibility === 'none' || moves.length === 0) {
    cg.setAutoShapes([]);
    return;
  }

  const visibleMoves = visibility === 'last'
    ? [moves[moves.length - 1]]
    : moves;

  const shapes: DrawShape[] = visibleMoves.map((move, i) => {
    const originalIndex = visibility === 'last' ? moves.length - 1 : i;
    const brush = colorMode === 'uniform'
      ? 'green'
      : (originalIndex % 2 === 0 ? 'green' : 'red');
    return { orig: move.from, dest: move.to, brush };
  });

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
