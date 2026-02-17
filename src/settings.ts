import type { Settings, ArrowVisibility, ArrowColorMode, BoardVisibility } from './types';

const STORAGE_KEY = 'chess-calc-settings';

const defaults: Settings = {
  arrowVisibility: 'all',
  arrowColorMode: 'per-player',
  boardVisibility: 'static',
  playerRating: 1500,
  ratingMin: 1450,
  ratingMax: 1550,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getArrowVisibility(): ArrowVisibility {
  return loadSettings().arrowVisibility;
}

export function getArrowColorMode(): ArrowColorMode {
  return loadSettings().arrowColorMode;
}

export function getBoardVisibility(): BoardVisibility {
  return loadSettings().boardVisibility;
}
