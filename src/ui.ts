import type { Move, Puzzle } from './types';
import { getCurrentLine, getCompletedLines } from './lines';
import { solutionToSan } from './validation';

const pieceIcons: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘',
};

function moveToUci(move: Move): string {
  return `${move.from}${move.to}`;
}

function sanWithIcon(san: string): string {
  const first = san[0];
  if (pieceIcons[first]) {
    return pieceIcons[first] + san.slice(1);
  }
  return san;
}

function formatLineUci(moves: Move[], startNumber: number = 1): string {
  let result = '';
  for (let i = 0; i < moves.length; i++) {
    const moveNum = startNumber + Math.floor(i / 2);
    if (i % 2 === 0) {
      result += `${moveNum}. ${moveToUci(moves[i])} `;
    } else {
      result += `${moveToUci(moves[i])} `;
    }
  }
  return result.trim();
}

function formatLineValidated(moves: Move[], startNumber: number = 1): string {
  let result = '';
  let seenIllegal = false;

  for (let i = 0; i < moves.length; i++) {
    const moveNum = startNumber + Math.floor(i / 2);
    const move = moves[i];

    if (!move.legal) seenIllegal = true;

    const text = (move.legal && move.san) ? sanWithIcon(move.san) : moveToUci(move);
    const moveHtml = seenIllegal
      ? `<span class="illegal-move">${text}</span>`
      : text;

    if (i % 2 === 0) {
      result += `${moveNum}. ${moveHtml} `;
    } else {
      result += `${moveHtml} `;
    }
  }
  return result.trim();
}

function formatSolution(fen: string, solution: string[]): string {
  const sanMoves = solutionToSan(fen, solution);
  let result = '';
  for (let i = 0; i < sanMoves.length; i++) {
    const moveNum = 1 + Math.floor(i / 2);
    const display = sanWithIcon(sanMoves[i]);
    if (i % 2 === 0) {
      result += `${moveNum}. ${display} `;
    } else {
      result += `${display} `;
    }
  }
  return result.trim();
}

export function updateLineDisplay(container: HTMLElement, finished: boolean = false, puzzle?: Puzzle) {
  const completedLines = getCompletedLines();
  const currentLine = getCurrentLine();

  let html = '';

  if (completedLines.length > 0 || currentLine.length > 0) {
    html += '<h3>Your Lines</h3>';
  }

  completedLines.forEach((line, idx) => {
    const movesHtml = finished ? formatLineValidated(line.moves) : formatLineUci(line.moves);
    html += `<div class="line completed-line">
      <span class="line-label">Line ${idx + 1}:</span>
      <span class="line-moves">${movesHtml}</span>
    </div>`;
  });

  if (currentLine.length > 0) {
    const movesHtml = finished ? formatLineValidated(currentLine) : formatLineUci(currentLine);
    html += `<div class="line current-line">
      <span class="line-label">${finished ? `Line ${completedLines.length + 1}:` : 'Current:'}</span>
      <span class="line-moves">${movesHtml}</span>
      ${!finished ? '<span class="in-progress">●</span>' : ''}
    </div>`;
  }

  if (finished && puzzle) {
    html += `<div class="solution">
      <h3>Solution</h3>
      <div class="line solution-line">
        <span class="line-moves">${formatSolution(puzzle.fen, puzzle.solution)}</span>
      </div>
    </div>`;
  }

  container.innerHTML = html;
}

export function updatePuzzleInfo(container: HTMLElement, puzzle: Puzzle) {
  let html = `<span class="puzzle-id">Puzzle: ${puzzle.id}</span>`;
  if (puzzle.rating) {
    html += ` <span class="puzzle-rating">Rating: ${puzzle.rating}</span>`;
  }
  if (puzzle.themes && puzzle.themes.length > 0) {
    html += ` <span class="puzzle-themes">${puzzle.themes.join(', ')}</span>`;
  }
  container.innerHTML = html;
}

export function setButtonStates(opts: {
  newLineBtn: HTMLButtonElement;
  undoBtn: HTMLButtonElement;
  finishedBtn: HTMLButtonElement;
  nextBtn: HTMLButtonElement;
  finished: boolean;
}) {
  const { newLineBtn, undoBtn, finishedBtn, nextBtn, finished } = opts;
  const currentLine = getCurrentLine();
  const completedLines = getCompletedLines();

  newLineBtn.disabled = finished || currentLine.length === 0;
  undoBtn.disabled = finished || currentLine.length === 0;
  finishedBtn.disabled = finished || (currentLine.length === 0 && completedLines.length === 0);
  nextBtn.disabled = !finished;
}
