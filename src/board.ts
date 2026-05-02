import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import type { Move } from './types';
import { getArrowVisibility, getArrowColorMode, getBoardVisibility } from './settings';

let cg: Api | null = null;
let boardElement: HTMLElement | null = null;
let currentFen: string = '';
let currentOrientation: 'white' | 'black' = 'white';
let lastDrawnMoves: Move[] = [];
let onMoveInput: ((from: Key, to: Key) => void) | null = null;
let resizeObserver: ResizeObserver | null = null;
let inputEnabled = true;
let selectedSquare: Key | null = null;
let pointerDownHandler: ((e: PointerEvent) => void) | null = null;
let pointerMoveHandler: ((e: PointerEvent) => void) | null = null;
let pointerUpHandler: ((e: PointerEvent) => void) | null = null;
let overlayElement: HTMLElement | null = null;

const files = 'abcdefgh';

export function setOnMoveInput(cb: (from: Key, to: Key) => void) {
  onMoveInput = cb;
}

function squareFromEvent(e: MouseEvent): Key | null {
  if (!boardElement) return null;
  const rect = boardElement.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;

  const cellW = rect.width / 8;
  const cellH = rect.height / 8;
  let col = Math.floor(x / cellW);
  let row = Math.floor(y / cellH);

  if (currentOrientation === 'white') {
    row = 7 - row;
  } else {
    col = 7 - col;
  }

  return `${files[col]}${row + 1}` as Key;
}

function updateSelectedHighlight() {
  if (!cg) return;
  if (selectedSquare) {
    cg.selectSquare(selectedSquare);
  } else {
    cg.selectSquare(null);
  }
}

// ---- Pointer-based input: supports both click-to-move and drag-to-move ----

let dragStart: Key | null = null;
let dragActive = false;
let pointerMoved = false;

function handlePointerDown(e: PointerEvent) {
  if (!inputEnabled) return;
  const square = squareFromEvent(e);
  if (!square) return;

  dragStart = square;
  pointerMoved = false;
  dragActive = true;
  overlayElement?.setPointerCapture(e.pointerId);
  overlayElement?.classList.add('dragging');
}

function handlePointerMove(e: PointerEvent) {
  if (!dragActive) return;
  // If pointer has moved from the start square, treat this as a drag
  const currentSquare = squareFromEvent(e);
  if (currentSquare && currentSquare !== dragStart) {
    pointerMoved = true;
  }
}

function handlePointerUp(e: PointerEvent) {
  if (!dragActive) return;
  dragActive = false;
  overlayElement?.classList.remove('dragging');

  const endSquare = squareFromEvent(e);

  if (pointerMoved && dragStart && endSquare && endSquare !== dragStart) {
    // Drag completed — emit the move
    selectedSquare = null;
    updateSelectedHighlight();
    if (onMoveInput) onMoveInput(dragStart, endSquare);
  } else if (dragStart) {
    // It was a click (no significant movement)
    handleSquareClick(dragStart);
  }

  dragStart = null;
  pointerMoved = false;
}

function handleSquareClick(square: Key) {
  if (!selectedSquare) {
    selectedSquare = square;
    updateSelectedHighlight();
  } else {
    if (square === selectedSquare) {
      // Clicked same square — deselect
      selectedSquare = null;
      updateSelectedHighlight();
      return;
    }
    const from = selectedSquare;
    selectedSquare = null;
    updateSelectedHighlight();
    if (onMoveInput) onMoveInput(from, square);
  }
}

export function initBoard(element: HTMLElement, fen: string, orientation: 'white' | 'black'): Api {
  boardElement = element;
  currentFen = fen;
  currentOrientation = orientation;
  selectedSquare = null;

  const isDynamic = getBoardVisibility() === 'dynamic';
  element.classList.toggle('static-board', !isDynamic);

  cg = Chessground(element, {
    fen,
    orientation,
    coordinates: true,
    movable: {
      free: false,
      color: undefined,
    },
    draggable: {
      enabled: false,
    },
    selectable: {
      enabled: false,
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

  // Attach pointer handlers to the overlay for click-to-move + drag-to-move
  overlayElement = document.getElementById('board-overlay');
  if (overlayElement) {
    if (pointerDownHandler) {
      overlayElement.removeEventListener('pointerdown', pointerDownHandler as EventListener);
      overlayElement.removeEventListener('pointermove', pointerMoveHandler as EventListener);
      overlayElement.removeEventListener('pointerup', pointerUpHandler as EventListener);
    }
    pointerDownHandler = (e: PointerEvent) => handlePointerDown(e);
    pointerMoveHandler = (e: PointerEvent) => handlePointerMove(e);
    pointerUpHandler = (e: PointerEvent) => handlePointerUp(e);
    overlayElement.addEventListener('pointerdown', pointerDownHandler);
    overlayElement.addEventListener('pointermove', pointerMoveHandler);
    overlayElement.addEventListener('pointerup', pointerUpHandler);
  }

  // Make the board resizable — keep it square and sync chessground + overlay
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
      // Keep the wrap div in sync too
      const boardWrap = element.parentElement;
      if (boardWrap) {
        boardWrap.style.width = `${size}px`;
        boardWrap.style.height = `${size}px`;
      }
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
  });
}

export function drawSetupArrow(from: Key, to: Key) {
  if (!cg) return;
  cg.setAutoShapes([{ orig: from, dest: to, brush: 'yellow' }]);
}

export function playSetupMove(from: Key, to: Key): Promise<void> {
  return new Promise(resolve => {
    if (!cg) { resolve(); return; }
    cg.set({ animation: { enabled: true } });
    cg.move(from, to);
    setTimeout(resolve, 350);
  });
}

/** Move a piece on the board — only has effect in dynamic visibility mode. */
export function animateMove(from: Key, to: Key) {
  if (!cg) return;
  if (getBoardVisibility() === 'dynamic') {
    cg.move(from, to);
  }
}

export function resetToInitial() {
  selectedSquare = null;
  resetPosition();
}

export function replayMoves(moves: Move[]) {
  if (!cg) return;
  resetPosition();
  if (getBoardVisibility() === 'dynamic') {
    for (const move of moves) {
      cg.move(move.from, move.to);
    }
  }
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

export function syncSettings() {
  if (!cg || !boardElement) return;

  const isDynamic = getBoardVisibility() === 'dynamic';
  boardElement.classList.toggle('static-board', !isDynamic);
  cg.set({ animation: { enabled: isDynamic } });

  // Re-render arrows in case arrow visibility / color settings changed
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
  inputEnabled = enabled;
  if (!enabled) {
    selectedSquare = null;
    if (cg) cg.selectSquare(null);
  }
}
