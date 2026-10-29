import { describe, it, expect } from 'vitest';
import { evaluateAgainstBook } from '../analysis-eval';
import type { BookLine, Line, Move } from '../types';

const mv = (from: string, to: string, legal = true): Move => ({ from, to, legal } as Move);
const line = (...moves: Move[]): Line => ({ moves });
const book = (id: string, uci: string[], required = true, depth = 0): BookLine => ({
  id, depth, required, uci, san: [],
});

describe('evaluateAgainstBook', () => {
  const main = book('main', ['e2e4', 'e7e5', 'g1f3']);
  const side = book('side', ['e2e4', 'c7c5'], true, 1);

  it('marks a line full when every ply is reproduced', () => {
    const r = evaluateAgainstBook([line(mv('e2', 'e4'), mv('e7', 'e5'), mv('g1', 'f3'))], [main]);
    expect(r.results[0].status).toBe('full');
    expect(r.requiredCovered).toBe(1);
  });

  it('reports partial coverage with the matched ply count', () => {
    const r = evaluateAgainstBook([line(mv('e2', 'e4'), mv('e7', 'e5'))], [main]);
    expect(r.results[0]).toMatchObject({ status: 'partial', matched: 2 });
    expect(r.requiredCovered).toBe(0);
  });

  it('marks a line none when the first ply differs', () => {
    const r = evaluateAgainstBook([line(mv('d2', 'd4'))], [main]);
    expect(r.results[0].status).toBe('none');
    expect(r.results[0].userLine).toBeNull();
  });

  it('lets different player lines cover different book lines', () => {
    const r = evaluateAgainstBook(
      [line(mv('e2', 'e4'), mv('e7', 'e5'), mv('g1', 'f3')), line(mv('e2', 'e4'), mv('c7', 'c5'))],
      [main, side],
    );
    expect(r.results.map((x) => x.status)).toEqual(['full', 'full']);
    expect(r.results[1].userLine).toBe(1);
    expect(r.requiredCovered).toBe(2);
  });

  it('ignores moves after the first illegal one', () => {
    const r = evaluateAgainstBook([line(mv('e2', 'e4'), mv('e7', 'e6', false), mv('g1', 'f3'))], [main]);
    expect(r.results[0]).toMatchObject({ status: 'partial', matched: 1 });
  });

  it('does not count optional lines toward the required total', () => {
    const deep = book('deep', ['e2e4', 'e7e5', 'f1c4'], false, 2);
    const r = evaluateAgainstBook([line(mv('e2', 'e4'), mv('e7', 'e5'), mv('f1', 'c4'))], [main, deep]);
    expect(r.requiredTotal).toBe(1);
    expect(r.requiredCovered).toBe(0);
    expect(r.results[1].status).toBe('full');
  });

  it('ignores the promotion piece when comparing moves', () => {
    const promo = book('promo', ['a7a8q']);
    const r = evaluateAgainstBook([line(mv('a7', 'a8'))], [promo]);
    expect(r.results[0].status).toBe('full');
  });
});
