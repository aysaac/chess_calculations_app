import type { Key } from 'chessground/types';
import type { Move, Line } from './types';
import { drawArrows, resetToInitial, replayMoves } from './board';

let currentLine: Move[] = [];
let completedLines: Line[] = [];
let onChange: (() => void) | null = null;

export function setOnChange(cb: () => void) {
  onChange = cb;
}

function notify() {
  if (onChange) onChange();
}

export function addMove(from: Key, to: Key) {
  currentLine.push({ from, to });
  drawArrows(currentLine);
  notify();
}

export function undo() {
  if (currentLine.length === 0) return;
  currentLine.pop();
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
  // If there's an in-progress line, include it
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
