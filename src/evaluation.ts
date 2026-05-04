import type { Move, Line, EvalPv, CloudEvalResponse, LineScore, EvaluationResult } from './types';
import { evaluateWithStockfish } from './engine';

// ---- Constants ----

/** Centipawn difference between best and 2nd-best PV to consider best move "forced". */
const FORCED_THRESHOLD = 25;

/** Centipawn range from best PV to consider a PV "important". */
const IMPORTANT_THRESHOLD = 100;

/** How many engine lines to request. */
const DEFAULT_MULTI_PV = 5;

// ---- API ----

/**
 * Fetch a cloud evaluation for a position from the Lichess API.
 * Returns null if the position isn't in the cache (404) or on network error.
 */
export async function fetchCloudEval(
  fen: string,
  multiPv: number = DEFAULT_MULTI_PV,
): Promise<CloudEvalResponse | null> {
  try {
    const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=${multiPv}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return (await resp.json()) as CloudEvalResponse;
  } catch {
    return null;
  }
}

// ---- Helpers ----

/** Split a PV moves string like "e2e4 e7e5 g1f3" into individual UCI moves. */
export function pvToUciSequence(pvMoves: string): string[] {
  return pvMoves.trim().split(/\s+/).filter(Boolean);
}

/** Convert a user Move[] into a UCI string array. */
export function lineToUciSequence(moves: Move[]): string[] {
  return moves.map(m => `${m.from}${m.to}`);
}

/** Format centipawns into a human-readable string, e.g. 42 → "+0.4", -120 → "-1.2". */
export function cpToString(cp: number): string {
  const sign = cp > 0 ? '+' : '';
  return `${sign}${(cp / 100).toFixed(1)}`;
}

/** Find the best-matching engine PV for a user line. */
function matchLineToPv(
  userLineUci: string[],
  pvs: EvalPv[],
): { cp: number | null; pvIndex: number | null; matchedMoves: number; pvLength: number } {
  if (userLineUci.length === 0) {
    return { cp: null, pvIndex: null, matchedMoves: 0, pvLength: 0 };
  }

  for (let i = 0; i < pvs.length; i++) {
    const pvMoves = pvToUciSequence(pvs[i].moves);

    // Match as many moves as possible — up to the shorter of the two sequences
    const matchLen = Math.min(userLineUci.length, pvMoves.length);
    let matched = 0;
    while (matched < matchLen && userLineUci[matched] === pvMoves[matched]) {
      matched++;
    }

    if (matched > 0) {
      return { cp: pvs[i].cp, pvIndex: i, matchedMoves: matched, pvLength: pvMoves.length };
    }
  }

  return { cp: null, pvIndex: null, matchedMoves: 0, pvLength: 0 };
}

/** Count how many PVs from the list have their first move covered by any user line. */
function countFirstMoveCovered(pvs: EvalPv[], userLinesUci: string[][]): number {
  let covered = 0;
  for (const pv of pvs) {
    const pvMoves = pvToUciSequence(pv.moves);
    if (pvMoves.length === 0) continue;
    const firstMove = pvMoves[0];
    if (userLinesUci.some(line => line.length > 0 && line[0] === firstMove)) {
      covered++;
    }
  }
  return covered;
}

// ---- PV source (cloud first, Stockfish fallback) ----

/** Get engine PVs for a position — tries cloud cache first, falls back to Stockfish. */
async function getPvs(fen: string, multiPv: number): Promise<EvalPv[] | null> {
  // 1. Try Lichess cloud eval
  const cloud = await fetchCloudEval(fen, multiPv);
  if (cloud && cloud.pvs && cloud.pvs.length > 0) {
    return cloud.pvs;
  }

  // 2. Fall back to Stockfish WASM
  const sf = await evaluateWithStockfish(fen, multiPv);
  if (sf && sf.length > 0) {
    return sf;
  }

  return null;
}

export { preloadEngine } from './engine';

// ---- Main evaluation ----

/**
 * Evaluate the user's lines against engine analysis of the puzzle position.
 *
 * Metrics:
 *  - Per-line engine scores (centipawns)
 *  - Forced lines covered
 *  - Important lines covered
 *  - Difference between user's best and engine's best
 */
export async function evaluateLines(
  puzzleFen: string,
  completedLines: Line[],
  currentLine: Move[],
): Promise<EvaluationResult> {
  // Gather all non-empty user lines
  const allLines: { moves: Move[]; label: string; index: number }[] = [];
  completedLines.forEach((line, idx) => {
    if (line.moves.length > 0) {
      allLines.push({ moves: line.moves, label: `Line ${idx + 1}`, index: idx });
    }
  });
  if (currentLine.length > 0) {
    allLines.push({ moves: currentLine, label: `Line ${completedLines.length + 1}`, index: completedLines.length });
  }

  const noDataResult: EvaluationResult = {
    lineScores: [],
    forcedLinesTotal: 0,
    forcedLinesCovered: 0,
    importantLinesTotal: 0,
    importantLinesCovered: 0,
    engineBestCp: 0,
    userBestCp: null,
    pvs: [],
    hasData: false,
  };

  if (allLines.length === 0) return noDataResult;

  const pvs = await getPvs(puzzleFen, DEFAULT_MULTI_PV);
  if (!pvs || pvs.length === 0) return noDataResult;

  const userLinesUci = allLines.map(l => lineToUciSequence(l.moves));

  // 1. Score each user line
  const lineScores: LineScore[] = userLinesUci.map((uci, idx) => {
    const { cp, pvIndex, matchedMoves, pvLength } = matchLineToPv(uci, pvs);
    return {
      lineIndex: allLines[idx].index,
      label: allLines[idx].label,
      cp,
      matchedPvIndex: pvIndex,
      matchedMoves,
      pvLength,
    };
  });

  // 2. Forced lines: best line is forced if it's significantly better than 2nd best
  let forcedLinesTotal = 0;
  let forcedLinesCovered = 0;
  if (pvs.length >= 2 && pvs[0].cp - pvs[1].cp > FORCED_THRESHOLD) {
    forcedLinesTotal = 1;
    forcedLinesCovered = countFirstMoveCovered([pvs[0]], userLinesUci);
  }

  // 3. Important lines: all PVs within IMPORTANT_THRESHOLD of the best
  const bestCp = pvs[0].cp;
  const important = pvs.filter(pv => bestCp - pv.cp <= IMPORTANT_THRESHOLD);
  const importantLinesTotal = important.length;
  const importantLinesCovered = countFirstMoveCovered(important, userLinesUci);

  // 4. Best-line comparison
  const userBestCp = lineScores.reduce((best: number | null, ls) => {
    if (ls.cp === null) return best;
    return best === null ? ls.cp : Math.max(best, ls.cp);
  }, null);

  return {
    lineScores,
    forcedLinesTotal,
    forcedLinesCovered,
    importantLinesTotal,
    importantLinesCovered,
    engineBestCp: bestCp,
    userBestCp,
    pvs,
    hasData: true,
  };
}
