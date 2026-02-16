import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './style.css';

import { initBoard } from './board';
import { loadPuzzle, setPuzzleSource, getPuzzleSource } from './puzzle';
import { initInput, setInputEnabled } from './input';
import { newLine, undo, finish, reset, setOnChange } from './lines';
import { updateLineDisplay, updatePuzzleInfo, setButtonStates } from './ui';
import type { Puzzle } from './types';

let currentPuzzle: Puzzle | null = null;
let isFinished = false;

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
  updateLineDisplay(linesEl, isFinished, currentPuzzle ?? undefined);
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
  reset();

  try {
    currentPuzzle = await loadPuzzle();
  } catch (err) {
    statusEl.textContent = `Failed to load puzzle: ${err}`;
    return;
  }

  initBoard(boardEl, currentPuzzle.fen, currentPuzzle.playerColor);
  initInput();
  setInputEnabled(true);
  updatePuzzleInfo(puzzleInfoEl, currentPuzzle);
  statusEl.textContent = `${currentPuzzle.playerColor === 'white' ? 'White' : 'Black'} to move. Drag pieces or click squares to input your lines.`;
  updateUI();
}

// Button handlers
newLineBtn.addEventListener('click', () => {
  newLine();
});

undoBtn.addEventListener('click', () => {
  undo();
});

finishedBtn.addEventListener('click', () => {
  isFinished = true;
  setInputEnabled(false);
  finish();
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

// Start
sourceToggle.textContent = `Source: ${getPuzzleSource().toUpperCase()}`;
startPuzzle();

