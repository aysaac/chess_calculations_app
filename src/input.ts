import type { Key } from 'chessground/types';
import { setOnMoveInput, setInputEnabled as setBoardInputEnabled } from './board';
import { addMove } from './lines';

let enabled = true;

function handleMove(from: Key, to: Key) {
  if (!enabled) return;
  addMove(from, to);
}

export function initInput() {
  setOnMoveInput(handleMove);
}

export function setInputEnabled(val: boolean) {
  enabled = val;
  setBoardInputEnabled(val);
}
