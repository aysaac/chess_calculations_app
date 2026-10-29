import { Chess } from 'chess.js';
import type { BookProblem } from './types';

const STORAGE_KEY = 'chess-calc-book-analysis';

/** Keep only well-formed problems (valid FEN, at least one line). */
export function parseBook(json: string): BookProblem[] {
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error('Expected a JSON array of problems');
  const valid: BookProblem[] = [];
  for (const item of data as BookProblem[]) {
    if (!item || typeof item.id !== 'string' || typeof item.fen !== 'string') continue;
    if (!Array.isArray(item.lines) || item.lines.length === 0) continue;
    try {
      new Chess(item.fen);
    } catch {
      continue;
    }
    valid.push(item);
  }
  if (valid.length === 0) throw new Error('No usable problems found in the file');
  return valid;
}

export function loadBook(): BookProblem[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseBook(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Optional default dataset served from public/book/ (gitignored, so it only exists
 * on machines where the file was placed). Missing or invalid files yield null.
 */
export async function loadPreloadedBook(): Promise<BookProblem[] | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}book/analysis_book.json`);
    if (!res.ok) return null;
    return parseBook(await res.text());
  } catch {
    return null;
  }
}

/** Returns false when storage is unavailable or full; the book then lives in memory only. */
export function saveBook(json: string): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch {
    return false;
  }
}

export function clearBook(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
