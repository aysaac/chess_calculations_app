import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Settings } from '../types';

// Mock localStorage
const store: Record<string, string> = {};

beforeEach(() => {
  // Clear store before each test
  Object.keys(store).forEach(k => delete store[k]);
  // Mock localStorage
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    },
    writable: true,
  });
});

// Import after mock is set up
import { loadSettings, saveSettings, getArrowVisibility, getArrowColorMode, getBoardVisibility } from '../settings';

describe('loadSettings', () => {
  it('returns defaults when nothing is stored', () => {
    const s = loadSettings();
    expect(s.arrowVisibility).toBe('all');
    expect(s.arrowColorMode).toBe('per-player');
    expect(s.boardVisibility).toBe('static');
    expect(s.playerRating).toBe(1500);
    expect(s.ratingMin).toBe(1450);
    expect(s.ratingMax).toBe(1550);
  });

  it('returns stored settings merged with defaults', () => {
    store['chess-calc-settings'] = JSON.stringify({
      arrowVisibility: 'none',
      playerRating: 2000,
    });
    const s = loadSettings();
    expect(s.arrowVisibility).toBe('none');          // overridden
    expect(s.playerRating).toBe(2000);               // overridden
    expect(s.arrowColorMode).toBe('per-player');      // default
    expect(s.boardVisibility).toBe('static');          // default
    expect(s.ratingMin).toBe(1450);                   // default
  });

  it('survives corrupt JSON in localStorage', () => {
    store['chess-calc-settings'] = '{broken';
    const s = loadSettings();
    // Should fall back to defaults
    expect(s.arrowVisibility).toBe('all');
  });
});

describe('saveSettings', () => {
  it('persists settings to localStorage', () => {
    const s: Settings = {
      arrowVisibility: 'last',
      arrowColorMode: 'uniform',
      boardVisibility: 'dynamic',
      playerRating: 1800,
      ratingMin: 1700,
      ratingMax: 1900,
    };
    saveSettings(s);

    const raw = store['chess-calc-settings'];
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw);
    expect(parsed.arrowVisibility).toBe('last');
    expect(parsed.arrowColorMode).toBe('uniform');
    expect(parsed.boardVisibility).toBe('dynamic');
    expect(parsed.playerRating).toBe(1800);
  });
});

describe('getArrowVisibility', () => {
  it('reads from stored settings', () => {
    store['chess-calc-settings'] = JSON.stringify({ arrowVisibility: 'last' });
    expect(getArrowVisibility()).toBe('last');
  });
});

describe('getArrowColorMode', () => {
  it('reads from stored settings', () => {
    store['chess-calc-settings'] = JSON.stringify({ arrowColorMode: 'uniform' });
    expect(getArrowColorMode()).toBe('uniform');
  });
});

describe('getBoardVisibility', () => {
  it('reads from stored settings', () => {
    store['chess-calc-settings'] = JSON.stringify({ boardVisibility: 'dynamic' });
    expect(getBoardVisibility()).toBe('dynamic');
  });
});
