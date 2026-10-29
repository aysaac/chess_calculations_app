import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './style.css';

import { Chess } from 'chess.js';
import { initBoard } from './board';
import { initInput, setInputEnabled } from './input';
import { newLine, undo, finish, reset, setOnChange, setPuzzleFen } from './lines';
import { updateLineDisplay, setButtonStates, sanWithIcon } from './ui';
import { solutionToSan } from './validation';
import { evaluateAgainstBook } from './analysis-eval';
import { createTimer } from './timer';
import { parseBook, loadBook, loadPreloadedBook, saveBook, clearBook } from './analysis-store';
import type { BookProblem, BookEvaluation, BookLine, Line } from './types';

let book: BookProblem[] = [];
let current: BookProblem | null = null;
let isFinished = false;

const boardEl = document.getElementById('board')!;
const linesEl = document.getElementById('lines')!;
const infoEl = document.getElementById('puzzle-info')!;
const promptEl = document.getElementById('book-prompt')!;
const resultEl = document.getElementById('book-result')!;
const statusEl = document.getElementById('status')!;
const newLineBtn = document.getElementById('btn-new-line') as HTMLButtonElement;
const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
const finishedBtn = document.getElementById('btn-finished') as HTMLButtonElement;
const nextBtn = document.getElementById('btn-next') as HTMLButtonElement;
const fileInput = document.getElementById('book-file') as HTMLInputElement;
const clearBtn = document.getElementById('btn-clear-book') as HTMLButtonElement;

const timer = createTimer(
  document.getElementById('timer-display')!,
  document.getElementById('btn-timer') as HTMLButtonElement,
);

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** "14. ♗xd5 exd5 15. ♘e5" from a start FEN and UCI moves. */
function formatBookLine(fen: string, uci: string[]): string {
  const parts = fen.split(' ');
  const whiteFirst = parts[1] === 'w';
  const startNumber = parseInt(parts[5] ?? '1', 10) || 1;
  const san = solutionToSan(fen, uci);
  let out = '';
  san.forEach((move, i) => {
    const ply = i + (whiteFirst ? 0 : 1);
    const number = startNumber + Math.floor(ply / 2);
    const display = sanWithIcon(move);
    if (ply % 2 === 0) out += `${number}. ${display} `;
    else out += i === 0 ? `${number}... ${display} ` : `${display} `;
  });
  return out.trim();
}

function isShaky(problem: BookProblem): boolean {
  return problem.meta.failed >= 3;
}

function renderPrompt(problem: BookProblem): void {
  const sideName = problem.side === 'white' ? 'White' : 'Black';
  let html = `<div class="book-side">${sideName} to move</div>`;
  if (isShaky(problem)) {
    html += `<p class="book-warning">The starting position of this problem may contain an OCR error.</p>`;
  }
  promptEl.innerHTML = html;
}

function renderLineRow(problem: BookProblem, r: BookEvaluation['results'][number]): string {
  const mark = r.status === 'full' ? '✓' : r.status === 'partial' ? '◐' : '✗';
  const progress = r.status === 'partial' ? ` <span class="book-progress">(${r.matched}/${r.line.uci.length})</span>` : '';
  return `<div class="book-line book-${r.status}">
    <span class="book-mark">${mark}</span>
    <span class="line-moves">${formatBookLine(problem.fen, r.line.uci)}</span>${progress}
  </div>`;
}

function renderResult(problem: BookProblem, evaluation: BookEvaluation): string {
  const required = evaluation.results.filter((r) => r.line.required);
  const optional = evaluation.results.filter((r) => !r.line.required);

  let html = `<div class="evaluation book-evaluation">
    <h3>Book lines</h3>
    <div class="eval-metric">
      <span class="eval-label">Required lines covered:</span>
      <span class="eval-value">${evaluation.requiredCovered}/${evaluation.requiredTotal}</span>
    </div>
    ${required.map((r) => renderLineRow(problem, r)).join('')}`;

  if (optional.length > 0) {
    html += `<details class="book-optional"><summary>Deeper side lines (${optional.length}, optional)</summary>
      ${optional.map((r) => renderLineRow(problem, r)).join('')}
    </details>`;
  }
  html += '</div>';

  html += '<div class="evaluation book-text">';
  html += `<h3>Evaluation</h3>`;
  if (problem.evaluation) html += `<p class="book-eval-text">${esc(problem.evaluation)}</p>`;
  else html += `<p class="eval-no-data">The book gives no evaluation for this position.</p>`;
  if (problem.source) html += `<p class="book-source">${esc(problem.source)}</p>`;
  if (problem.candidates) html += `<p><strong>Candidate moves:</strong> ${esc(problem.candidates)}</p>`;
  const otherPlan = problem.side === 'white' ? problem.planBlack : problem.planWhite;
  if (otherPlan) {
    const who = problem.side === 'white' ? 'Black' : 'White';
    html += `<p><strong>${who}'s plan:</strong> ${esc(otherPlan)}</p>`;
  }
  if (problem.analysis) {
    html += `<details class="book-analysis"><summary>Book analysis (raw OCR text)</summary>
      <p>${esc(problem.analysis)}</p></details>`;
  }
  html += '</div>';
  return html;
}

function updateUI(): void {
  updateLineDisplay(linesEl, isFinished);
  setButtonStates({ newLineBtn, undoBtn, finishedBtn, nextBtn, finished: isFinished });
}

function startProblem(problem: BookProblem): void {
  current = problem;
  isFinished = false;
  timer.reset();
  reset();
  setPuzzleFen(problem.fen);
  initBoard(boardEl, problem.fen, problem.side);
  initInput();
  setInputEnabled(true);
  resultEl.innerHTML = '';
  renderPrompt(problem);
  infoEl.innerHTML = `<span class="puzzle-id">Week ${problem.week}, day ${problem.day}${problem.label}</span>
    <span class="puzzle-themes">${problem.lines.filter((l) => l.required).length} book lines to find</span>`;
  statusEl.textContent = `${problem.side === 'white' ? 'White' : 'Black'} to move. Enter every line you would calculate.`;
  updateUI();
}

function randomProblem(): BookProblem | null {
  if (book.length === 0) return null;
  const pool = book.length > 1 ? book.filter((p) => p.id !== current?.id) : book;
  return pool[Math.floor(Math.random() * pool.length)];
}

function showEmptyState(message: string): void {
  current = null;
  promptEl.innerHTML = '';
  resultEl.innerHTML = '';
  linesEl.innerHTML = '';
  infoEl.innerHTML = '';
  statusEl.textContent = message;
  initBoard(boardEl, new Chess().fen(), 'white');
  setInputEnabled(false);
  setButtonStates({ newLineBtn, undoBtn, finishedBtn, nextBtn, finished: true });
  nextBtn.disabled = true;
}

function useBook(problems: BookProblem[]): void {
  book = problems;
  const first = randomProblem();
  if (first) startProblem(first);
}

newLineBtn.addEventListener('click', () => newLine());
undoBtn.addEventListener('click', () => undo());

finishedBtn.addEventListener('click', () => {
  if (!current) return;
  isFinished = true;
  timer.stop();
  setInputEnabled(false);
  const { completedLines, currentLine } = finish();
  const userLines: Line[] = [...completedLines];
  if (currentLine.length > 0) userLines.push({ moves: currentLine });
  const evaluation = evaluateAgainstBook(userLines, current.lines);
  resultEl.innerHTML = renderResult(current, evaluation);
  statusEl.textContent = `Covered ${evaluation.requiredCovered} of ${evaluation.requiredTotal} required book lines.`;
  updateUI();
});

nextBtn.addEventListener('click', () => {
  const next = randomProblem();
  if (next) startProblem(next);
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const problems = parseBook(text);
    const stored = saveBook(text);
    useBook(problems);
    statusEl.textContent = `Imported ${problems.length} problems${stored ? '' : ' (not saved: browser storage unavailable)'}.`;
  } catch (err) {
    statusEl.textContent = `Import failed: ${err instanceof Error ? err.message : err}`;
  } finally {
    fileInput.value = '';
  }
});

/** Imported data wins; otherwise fall back to the local preloaded file, if any. */
async function loadInitial(): Promise<void> {
  const stored = loadBook();
  if (stored) return useBook(stored);
  const preloaded = await loadPreloadedBook();
  if (preloaded) {
    useBook(preloaded);
    statusEl.textContent = `Loaded ${preloaded.length} preloaded problems. ${statusEl.textContent}`;
    return;
  }
  showEmptyState('No book data loaded. Import your own analysis JSON below.');
}

clearBtn.addEventListener('click', async () => {
  clearBook();
  book = [];
  showEmptyState('Imported data removed.');
  await loadInitial();
});

setOnChange(updateUI);

void loadInitial();

export type { BookLine };
