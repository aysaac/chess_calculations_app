import { Chess } from 'chess.js';
import type { Key } from 'chessground/types';
import type { Puzzle, PuzzleSource, CsvPuzzle } from './types';
import { loadSettings } from './settings';

let puzzleSource: PuzzleSource = 'api';
let csvPuzzles: CsvPuzzle[] | null = null;

export function setPuzzleSource(source: PuzzleSource) {
  puzzleSource = source;
}

export function getPuzzleSource(): PuzzleSource {
  return puzzleSource;
}

function parseCsv(text: string): CsvPuzzle[] {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',');
  const idIdx = header.indexOf('PuzzleId');
  const fenIdx = header.indexOf('FEN');
  const movesIdx = header.indexOf('Moves');
  const ratingIdx = header.indexOf('Rating');
  const themesIdx = header.indexOf('Themes');

  return lines.slice(1).map(line => {
    const cols = line.split(',');
    return {
      PuzzleId: cols[idIdx],
      FEN: cols[fenIdx],
      Moves: cols[movesIdx],
      Rating: cols[ratingIdx],
      Themes: cols[themesIdx],
    };
  });
}

function uciToMove(uci: string): { from: string; to: string; promotion?: string } {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}

function tryBuildPuzzle(entry: CsvPuzzle): Puzzle | null {
  const moves = entry.Moves.split(' ');

  // CSV FEN is the position before the opponent's last move.
  // First move in Moves is the opponent's move that sets up the puzzle.
  const preSetupFen = entry.FEN;
  const chess = new Chess(preSetupFen);
  const setupUci = moves[0];
  const setupMoveObj = uciToMove(setupUci);
  try {
    chess.move(setupMoveObj);
  } catch {
    return null;
  }

  const fen = chess.fen();
  const playerColor = chess.turn() === 'w' ? 'white' : 'black';
  const solution = moves.slice(1);

  // Validate every solution move is legal
  const verify = new Chess(fen);
  for (const uci of solution) {
    try {
      verify.move(uciToMove(uci));
    } catch {
      return null;
    }
  }

  return {
    id: entry.PuzzleId,
    preSetupFen,
    setupMove: { from: setupUci.slice(0, 2) as Key, to: setupUci.slice(2, 4) as Key },
    fen,
    solution,
    playerColor: playerColor as 'white' | 'black',
    rating: parseInt(entry.Rating, 10),
    themes: entry.Themes ? entry.Themes.split(' ') : [],
  };
}

async function loadFromCsv(): Promise<Puzzle> {
  if (!csvPuzzles) {
    const resp = await fetch('/puzzles.csv');
    const text = await resp.text();
    csvPuzzles = parseCsv(text);
  }

  const { ratingMin, ratingMax } = loadSettings();
  const filtered = csvPuzzles.filter(p => {
    const r = parseInt(p.Rating, 10);
    return r >= ratingMin && r <= ratingMax;
  });

  if (filtered.length === 0) {
    throw new Error(`No puzzles found in rating range ${ratingMin}–${ratingMax}`);
  }

  // Shuffle and try candidates until we find a valid one
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  for (const entry of shuffled) {
    const puzzle = tryBuildPuzzle(entry);
    if (puzzle) return puzzle;
  }

  throw new Error('No valid puzzles found in rating range (all had illegal moves)');
}

type LichessDifficulty = 'easiest' | 'easier' | 'normal' | 'harder' | 'hardest';

function ratingToDifficulty(rating: number): LichessDifficulty {
  if (rating < 1100) return 'easiest';
  if (rating < 1300) return 'easier';
  if (rating < 1700) return 'normal';
  if (rating < 2100) return 'harder';
  return 'hardest';
}

async function loadFromApi(): Promise<Puzzle> {
  const { ratingMin, ratingMax } = loadSettings();
  const targetRating = Math.round((ratingMin + ratingMax) / 2);
  const difficulty = ratingToDifficulty(targetRating);

  const resp = await fetch(`https://lichess.org/api/puzzle/next?difficulty=${difficulty}`);
  const data = await resp.json();

  const pgn = data.game.pgn;
  const initialPly = data.puzzle.initialPly;

  // Replay PGN up to initialPly to get the FEN
  const chess = new Chess();
  chess.loadPgn(pgn);
  const history = chess.history({ verbose: true });

  // Replay up to just before the setup move
  chess.reset();
  for (let i = 0; i < initialPly && i < history.length; i++) {
    chess.move(history[i].san);
  }
  const preSetupFen = chess.fen();

  // Play the setup move (opponent's triggering move)
  const setupHist = history[initialPly];
  chess.move(setupHist.san);

  const fen = chess.fen();
  const playerColor = chess.turn() === 'w' ? 'white' : 'black';
  const solution: string[] = data.puzzle.solution;

  return {
    id: data.puzzle.id,
    preSetupFen,
    setupMove: { from: setupHist.from as Key, to: setupHist.to as Key },
    fen,
    solution,
    playerColor: playerColor as 'white' | 'black',
    rating: data.puzzle.rating,
    themes: data.puzzle.themes,
  };
}

export async function loadPuzzle(): Promise<Puzzle> {
  if (puzzleSource === 'api') {
    return loadFromApi();
  }
  return loadFromCsv();
}
