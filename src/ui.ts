import type { Move, Puzzle, EvaluationResult } from './types';
import { getCurrentLine, getCompletedLines } from './lines';
import { Chess } from 'chess.js';
import { solutionToSan } from './validation';
import { pvToUciSequence, cpToString } from './evaluation';

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

export function updateLineDisplay(container: HTMLElement, finished: boolean = false, puzzle?: Puzzle, evaluation?: EvaluationResult) {
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

  if (finished && evaluation) {
    html += renderEvaluation(evaluation);
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

// ---- Evaluation display ----

/** Convert PV UCI moves to SAN-displayable string, e.g. "1. ♘f3 d5 2. c4 e6". */
function pvToSanFormatted(fen: string, uciMoves: string[]): string {
  const chess = new Chess(fen);
  let result = '';

  for (let i = 0; i < uciMoves.length; i++) {
    const uci = uciMoves[i];
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    let san: string;
    try {
      const move = chess.move({ from, to, promotion });
      san = move ? move.san : uci;
    } catch {
      san = uci;
    }

    const display = sanWithIcon(san);
    const moveNum = 1 + Math.floor(i / 2);

    if (i % 2 === 0) {
      result += `${moveNum}. ${display} `;
    } else {
      result += `${display} `;
    }
  }

  return result.trim();
}

function renderEvaluation(eval_: EvaluationResult): string {
  if (!eval_.hasData) {
    return `<div class="evaluation">
      <h3>Evaluation</h3>
      <p class="eval-no-data">No engine data available for this position.</p>
    </div>`;
  }

  let html = '<div class="evaluation"><h3>Evaluation</h3>';

  html += `<div class="eval-metric">
    <span class="eval-label">Engine eval:</span>
    <span class="eval-value eval-engine">${cpToString(eval_.engineBestCp)}</span>
  </div>`;

  // User's best line
  if (eval_.userBestCp !== null) {
    const diff = eval_.engineBestCp - eval_.userBestCp;
    const diffStr = diff > 0 ? ` (−${cpToString(diff)})` : diff < 0 ? ` (+${cpToString(-diff)})` : '';
    html += `<div class="eval-metric">
      <span class="eval-label">Your best line:</span>
      <span class="eval-value">${cpToString(eval_.userBestCp)}<span class="eval-diff">${diffStr}</span></span>
    </div>`;
  } else {
    html += `<div class="eval-metric">
      <span class="eval-label">Your best line:</span>
      <span class="eval-value eval-none">no match</span>
    </div>`;
  }

  // Forced lines
  html += `<div class="eval-metric">
    <span class="eval-label">Forced lines covered:</span>
    <span class="eval-value">${eval_.forcedLinesCovered}/${eval_.forcedLinesTotal}</span>
  </div>`;

  // Important lines
  html += `<div class="eval-metric">
    <span class="eval-label">Important lines covered:</span>
    <span class="eval-value">${eval_.importantLinesCovered}/${eval_.importantLinesTotal}</span>
  </div>`;

  // Engine PVs with matches
  html += '<div class="eval-pvs"><div class="eval-pvs-title">Engine top lines:</div>';
  eval_.pvs.forEach((pv, idx) => {
    const pvMoves = pvToUciSequence(pv.moves);
    const pvDisplay = pvToSanFormatted(eval_.puzzleFen, pvMoves.slice(0, 6));

    // Find which user line matched this PV
    const matched = eval_.lineScores.filter(ls => ls.matchedPvIndex === idx);
    const matchLabel = matched.length > 0
      ? ` ← ${matched.map(ls => {
          const detail = ls.matchedMoves < ls.pvLength ? ` (matched ${ls.matchedMoves}/${ls.pvLength})` : '';
          return `${ls.label}${detail}`;
        }).join(', ')}`
      : '';

    html += `<div class="eval-pv-line">
      <span class="eval-pv-index">${idx + 1}.</span>
      <span class="eval-pv-moves">${pvDisplay}</span>
      <span class="eval-pv-cp">(${cpToString(pv.cp)})</span>
      ${matchLabel ? `<span class="eval-pv-match">${matchLabel}</span>` : ''}
    </div>`;
  });
  html += '</div>';

  html += '</div>';
  return html;
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
