import type { Key } from 'chessground/types';

export interface Move {
  from: Key;
  to: Key;
}

export interface Line {
  moves: Move[];
}

export interface Puzzle {
  id: string;
  fen: string;
  solution: string[];       // UCI moves like "e2e4"
  playerColor: 'white' | 'black';
  rating?: number;
  themes?: string[];
}

export type PuzzleSource = 'api' | 'csv';

export interface CsvPuzzle {
  PuzzleId: string;
  FEN: string;
  Moves: string;
  Rating: string;
  Themes: string;
}

export type ArrowVisibility = 'all' | 'last' | 'none';
export type ArrowColorMode = 'uniform' | 'per-player';
export type BoardVisibility = 'static' | 'dynamic';

export interface Settings {
  arrowVisibility: ArrowVisibility;
  arrowColorMode: ArrowColorMode;
  boardVisibility: BoardVisibility;
  playerRating: number;
  ratingMin: number;
  ratingMax: number;
}
