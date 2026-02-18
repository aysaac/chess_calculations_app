import { Chess } from 'chess.js';
import type { Puzzle, PuzzleSource, CsvPuzzle } from './types';
import { loadSettings } from './settings';

let puzzleSource: PuzzleSource = 'csv';
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
  const chess = new Chess(entry.FEN);
  const setupMove = uciToMove(moves[0]);
  try {
    chess.move(setupMove);
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

async function loadFromApi(): Promise<Puzzle> {
  const resp = await fetch('https://lichess.org/api/puzzle/daily');
  const data = await resp.json();

  const pgn = data.game.pgn;
  const initialPly = data.puzzle.initialPly;

  // Replay PGN up to initialPly to get the FEN
  const chess = new Chess();
  chess.loadPgn(pgn);
  const history = chess.history({ verbose: true });

  // Reset and replay up to initialPly
  chess.reset();
  for (let i = 0; i < initialPly && i < history.length; i++) {
    chess.move(history[i].san);
  }

  const fen = chess.fen();
  const playerColor = chess.turn() === 'w' ? 'white' : 'black';

  return {
    id: data.puzzle.id,
    fen,
    solution: data.puzzle.solution,
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
