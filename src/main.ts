import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './style.css';

import { initBoard, playSetupMove, drawSetupArrow, syncSettings } from './board';
import { loadPuzzle, setPuzzleSource, getPuzzleSource } from './puzzle';
import { initInput, setInputEnabled } from './input';
import { newLine, undo, finish, reset, setOnChange, setPuzzleFen } from './lines';
import { updateLineDisplay, updatePuzzleInfo, setButtonStates } from './ui';
import { evaluateLines, preloadEngine } from './evaluation';
import type { Puzzle, EvaluationResult } from './types';

let currentPuzzle: Puzzle | null = null;
let isFinished = false;
let currentEvaluation: EvaluationResult | null = null;

// DOM elements
const boardEl = document.getElementById('board')!;
const linesEl = document.getElementById('lines')!;
const puzzleInfoEl = document.getElementById('puzzle-info')!;
const newLineBtn = document.getElementById('btn-new-line') as HTMLButtonElement;
const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
const finishedBtn = document.getElementById('btn-finished') as HTMLButtonElement;
const nextBtn = document.getElementById('btn-next') as HTMLButtonElement;
const sourceToggle = document.getElementById('source-toggle') as HTMLButtonElement;
const statusEl = document.getElementById('status')!;

function updateUI() {
  updateLineDisplay(linesEl, isFinished, currentPuzzle ?? undefined, currentEvaluation ?? undefined);
  setButtonStates({
    newLineBtn,
    undoBtn,
    finishedBtn,
    nextBtn,
    finished: isFinished,
  });
}

async function startPuzzle() {
  statusEl.textContent = 'Loading puzzle...';
  isFinished = false;
  currentEvaluation = null;
  reset();

  try {
    currentPuzzle = await loadPuzzle();
  } catch (err) {
    statusEl.textContent = `Failed to load puzzle: ${err}`;
    return;
  }

  setPuzzleFen(currentPuzzle.fen);
  // Show the pre-setup position first, with input disabled
  initBoard(boardEl, currentPuzzle.preSetupFen, currentPuzzle.playerColor);
  setInputEnabled(false);
  updatePuzzleInfo(puzzleInfoEl, currentPuzzle);
  updateUI();

  // Animate the opponent's setup move
  const { from, to } = currentPuzzle.setupMove;
  await playSetupMove(from, to);

  // Re-init the board with the real puzzle FEN so chessground has clean movable state
  initBoard(boardEl, currentPuzzle.fen, currentPuzzle.playerColor);
  initInput();
  drawSetupArrow(from, to);
  setInputEnabled(true);
  statusEl.textContent = `${currentPuzzle.playerColor === 'white' ? 'White' : 'Black'} to move. Drag pieces or click squares to input your lines.`;

  // Preload Stockfish in the background (only used as fallback if Lichess cache misses)
  preloadEngine();
}

// Button handlers
newLineBtn.addEventListener('click', () => {
  newLine();
});

undoBtn.addEventListener('click', () => {
  undo();
});

finishedBtn.addEventListener('click', async () => {
  isFinished = true;
  setInputEnabled(false);
  const { completedLines, currentLine } = finish();
  statusEl.textContent = 'Evaluating your lines...';
  updateUI();

  if (currentPuzzle) {
    currentEvaluation = await evaluateLines(currentPuzzle.fen, completedLines, currentLine);
  }

  statusEl.textContent = 'Compare your lines with the solution below.';
  updateUI();
});

nextBtn.addEventListener('click', () => {
  startPuzzle();
});

sourceToggle.addEventListener('click', () => {
  const current = getPuzzleSource();
  const next = current === 'csv' ? 'api' : 'csv';
  setPuzzleSource(next);
  sourceToggle.textContent = `Source: ${next.toUpperCase()}`;
});

// Wire up line change notifications
setOnChange(updateUI);

// Re-sync board with current settings when the page is restored from bfcache
// (e.g. user changes settings, then presses Back)
window.addEventListener('pageshow', (e) => {
  if (e.persisted) syncSettings();
});

// Start
sourceToggle.textContent = `Source: ${getPuzzleSource().toUpperCase()}`;
startPuzzle();
