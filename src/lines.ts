import type { Key } from 'chessground/types';
import type { Move, Line } from './types';
import { drawArrows, resetToInitial, replayMoves, animateMove } from './board';
import { validateMoves } from './validation';

let puzzleFen: string = '';
let currentLine: Move[] = [];
let completedLines: Line[] = [];
let onChange: (() => void) | null = null;

export function setOnChange(cb: () => void) {
  onChange = cb;
}

function notify() {
  if (onChange) onChange();
}

export function setPuzzleFen(fen: string) {
  puzzleFen = fen;
}

function revalidateCurrent() {
  if (puzzleFen && currentLine.length > 0) {
    currentLine = validateMoves(puzzleFen, currentLine);
  }
}

export function addMove(from: Key, to: Key) {
  currentLine.push({ from, to, legal: true });
  revalidateCurrent();
  animateMove(from, to);
  drawArrows(currentLine);
  notify();
}

export function undo() {
  if (currentLine.length === 0) return;
  currentLine.pop();
  revalidateCurrent();
  replayMoves(currentLine);
  drawArrows(currentLine);
  notify();
}

export function newLine() {
  if (currentLine.length === 0) return;
  completedLines.push({ moves: [...currentLine] });
  currentLine = [];
  resetToInitial();
  drawArrows(currentLine);
  notify();
}

export function finish(): { completedLines: Line[]; currentLine: Move[] } {
  const result = {
    completedLines: [...completedLines],
    currentLine: [...currentLine],
  };
  return result;
}

export function reset() {
  currentLine = [];
  completedLines = [];
  drawArrows(currentLine);
  notify();
}

export function getCurrentLine(): Move[] {
  return currentLine;
}

export function getCompletedLines(): Line[] {
  return completedLines;
}
