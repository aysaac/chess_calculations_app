import type { Key } from 'chessground/types';

export interface Move {
  from: Key;
  to: Key;
  san?: string;
  legal: boolean;
}

export interface Line {
  moves: Move[];
}

export interface Puzzle {
  id: string;
  preSetupFen: string;      // Position before the opponent's setup move
  setupMove: { from: Key; to: Key };  // The opponent's triggering move
  fen: string;              // Position after setup move (where player calculates from)
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
