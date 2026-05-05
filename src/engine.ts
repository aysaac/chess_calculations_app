import type { EvalPv } from './types';

// ---- Stockfish Web Worker wrapper ----
//
// The stockfish.js file in /public is the emscripten build of Stockfish 18 lite
// single-threaded. It runs in a Web Worker and communicates via UCI protocol.
//
// Init sequence:
//   1. new Worker('/stockfish.js')
//   2. postMessage('uci')  →  wait for 'uciok'
//   3. postMessage('setoption name MultiPV value 5')
//   4. For each evaluation: postMessage('position fen ...'), postMessage('go depth 15')
//   5. Parse 'info depth ... multipv N score cp X pv ...' lines
//   6. 'bestmove ...' signals search complete

const EVAL_DEPTH = 15;
const EVAL_TIMEOUT_MS = 15_000;

interface PendingEval {
  resolve: (pvs: EvalPv[]) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

let worker: Worker | null = null;
let engineReady = false;
let initPromise: Promise<void> | null = null;
let pending: PendingEval | null = null;
let pvs: EvalPv[] = [];
let multipvSetting = 5;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker('/stockfish.js');
    worker.onmessage = handleMessage;
    worker.onerror = (e) => {
      console.error('Stockfish worker error:', e);
      if (pending) {
        pending.reject(new Error('Stockfish worker error'));
        clearTimeout(pending.timer);
        pending = null;
      }
    };
  }
  return worker;
}

function handleMessage(e: MessageEvent<string>) {
  const line = e.data.trim();
  if (!line) return;

  // Engine identification — ignore
  if (line.startsWith('Stockfish')) return;

  // UCI init complete
  if (line === 'uciok') {
    engineReady = true;
    return;
  }

  // Info line with score and PV
  if (line.startsWith('info depth') && line.includes(' pv ')) {
    const cpMatch = line.match(/ score cp (-?\d+)/);
    const pvMatch = line.match(/ pv (.+)/);
    if (!cpMatch || !pvMatch) return;

    const mpvMatch = line.match(/ multipv (\d+)/);
    const idx = mpvMatch ? parseInt(mpvMatch[1]) - 1 : 0;
    const cp = parseInt(cpMatch[1]);

    // Only keep the deepest (last) info per multipv index
    pvs[idx] = { moves: pvMatch[1].trim(), cp };
    return;
  }

  // Search complete
  if (line.startsWith('bestmove')) {
    if (pending) {
      const result = pvs.filter(Boolean);
      pvs = [];
      pending.resolve(result);
      clearTimeout(pending.timer);
      pending = null;
    }
    return;
  }
}

/** Start loading the engine. Safe to call multiple times — returns the same promise. */
export function preloadEngine(): void {
  if (initPromise) return;
  if (engineReady) return;

  initPromise = new Promise<void>((resolve, reject) => {
    const w = getWorker();

    const timeout = setTimeout(() => {
      reject(new Error('Stockfish engine initialization timed out'));
    }, EVAL_TIMEOUT_MS);

    // We need to intercept the uciok response
    const originalHandler = w.onmessage;
    w.onmessage = (e: MessageEvent<string>) => {
      if (e.data.trim() === 'uciok') {
        engineReady = true;
        clearTimeout(timeout);
        w.onmessage = originalHandler;

        // Set MultiPV
        w.postMessage(`setoption name MultiPV value ${multipvSetting}`);

        resolve();
        return;
      }
      // Pass through to original handler
      originalHandler?.call(w, e);
    };

    w.postMessage('uci');
  }).catch((err) => {
    console.error('Failed to initialize Stockfish engine:', err);
    engineReady = false;
    initPromise = null;
    // Don't rethrow — caller handles missing engine gracefully
  });
}

/**
 * Evaluate a position with Stockfish.
 * Returns PVs sorted by multipv index — same shape as Lichess Cloud Eval response.
 * Returns null if engine isn't ready or on timeout.
 */
export function evaluateWithStockfish(
  fen: string,
  multiPv: number = 5,
): Promise<EvalPv[] | null> {
  return new Promise((resolve) => {
    if (!engineReady || !worker) {
      resolve(null);
      return;
    }

    // Update MultiPV if different
    if (multiPv !== multipvSetting) {
      multipvSetting = multiPv;
      worker.postMessage(`setoption name MultiPV value ${multiPv}`);
    }

    const timer = setTimeout(() => {
      if (pending) {
        worker!.postMessage('stop');
        pending.reject(new Error('Evaluation timed out'));
        pending = null;
        pvs = [];
      }
      resolve(null);
    }, EVAL_TIMEOUT_MS);

    pending = {
      resolve: (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      reject: () => {
        clearTimeout(timer);
        resolve(null);
      },
      timer,
    };

    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${EVAL_DEPTH}`);
  });
}
