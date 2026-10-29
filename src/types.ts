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

// ---- Evaluation types ----

export interface EvalPv {
  moves: string;  // space-separated UCI, e.g. "e2e4 e7e5 g1f3"
  cp: number;     // centipawns from side-to-move perspective
}

export interface CloudEvalResponse {
  fen: string;
  knodes: number;
  depth: number;
  pvs: EvalPv[];
}

export interface LineScore {
  lineIndex: number;
  label: string;                 // "Line 1", "Line 2", etc.
  cp: number | null;             // null = no engine match
  matchedPvIndex: number | null;
  matchedMoves: number;          // how many moves matched the PV
  pvLength: number;              // total PV length
}

export interface EvaluationResult {
  lineScores: LineScore[];
  forcedLinesTotal: number;
  forcedLinesCovered: number;
  importantLinesTotal: number;
  importantLinesCovered: number;
  engineBestCp: number;
  userBestCp: number | null;
  pvs: EvalPv[];
  hasData: boolean;
  puzzleFen: string;
  solutionLength: number;
}

// ---- Book analysis mode ----

export interface BookLine {
  id: string;
  depth: number;        // 0 = main line, 1 = first-level variation, ...
  required: boolean;    // lines the player must propose (depth <= 1)
  uci: string[];
  san: string[];
}

export interface BookProblem {
  id: string;
  week: number;
  day: number;
  label: string;        // "a" | "b"
  side: 'white' | 'black';
  pdfPage: number;
  fen: string;
  source: string;
  planWhite: string;
  planBlack: string;
  candidates: string;
  analysis: string;
  evaluation: string;
  lines: BookLine[];
  meta: {
    fenSource: string;
    failed: number;     // moves in the text that could not be placed from this position
    accepted: number;
    ambiguous: number;
    note: string;
  };
}

export interface BookLineResult {
  line: BookLine;
  matched: number;               // leading plies of the book line the player reproduced
  status: 'full' | 'partial' | 'none';
  userLine: number | null;       // index of the best-matching player line
}

export interface BookEvaluation {
  results: BookLineResult[];
  requiredTotal: number;
  requiredCovered: number;
}
