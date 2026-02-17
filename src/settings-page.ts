import './settings.css';
import { loadSettings, saveSettings } from './settings';
import type { ArrowVisibility, ArrowColorMode, BoardVisibility } from './types';

const settings = loadSettings();

// Board config elements
const optVisibility = document.getElementById('opt-arrow-visibility') as HTMLSelectElement;
const optColor = document.getElementById('opt-arrow-color') as HTMLSelectElement;
const optBoard = document.getElementById('opt-board-visibility') as HTMLSelectElement;

// Puzzle config elements
const optPlayerRating = document.getElementById('opt-player-rating') as HTMLInputElement;
const optRatingMin = document.getElementById('opt-rating-min') as HTMLInputElement;
const optRatingMax = document.getElementById('opt-rating-max') as HTMLInputElement;
const sliderMin = document.getElementById('slider-min') as HTMLInputElement;
const sliderMax = document.getElementById('slider-max') as HTMLInputElement;

// Initialize values
optVisibility.value = settings.arrowVisibility;
optColor.value = settings.arrowColorMode;
optBoard.value = settings.boardVisibility;
optPlayerRating.value = String(settings.playerRating);
optRatingMin.value = String(settings.ratingMin);
optRatingMax.value = String(settings.ratingMax);
sliderMin.value = String(settings.ratingMin);
sliderMax.value = String(settings.ratingMax);

function showSaved() {
  const el = document.getElementById('save-status')!;
  el.textContent = 'Settings saved';
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 1500);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function syncRatingRange() {
  // Ensure min <= max
  if (settings.ratingMin > settings.ratingMax) {
    settings.ratingMin = settings.ratingMax;
  }
  optRatingMin.value = String(settings.ratingMin);
  optRatingMax.value = String(settings.ratingMax);
  sliderMin.value = String(settings.ratingMin);
  sliderMax.value = String(settings.ratingMax);
  saveSettings(settings);
  showSaved();
}

// Puzzle config handlers
optPlayerRating.addEventListener('change', () => {
  settings.playerRating = clamp(parseInt(optPlayerRating.value, 10) || 1500, 400, 3000);
  optPlayerRating.value = String(settings.playerRating);
  settings.ratingMin = clamp(settings.playerRating - 50, 400, 3000);
  settings.ratingMax = clamp(settings.playerRating + 50, 400, 3000);
  syncRatingRange();
});

optRatingMin.addEventListener('change', () => {
  settings.ratingMin = clamp(parseInt(optRatingMin.value, 10) || 400, 400, 3000);
  if (settings.ratingMin > settings.ratingMax) settings.ratingMax = settings.ratingMin;
  syncRatingRange();
});

optRatingMax.addEventListener('change', () => {
  settings.ratingMax = clamp(parseInt(optRatingMax.value, 10) || 3000, 400, 3000);
  if (settings.ratingMax < settings.ratingMin) settings.ratingMin = settings.ratingMax;
  syncRatingRange();
});

sliderMin.addEventListener('input', () => {
  settings.ratingMin = parseInt(sliderMin.value, 10);
  if (settings.ratingMin > settings.ratingMax) {
    settings.ratingMax = settings.ratingMin;
  }
  syncRatingRange();
});

sliderMax.addEventListener('input', () => {
  settings.ratingMax = parseInt(sliderMax.value, 10);
  if (settings.ratingMax < settings.ratingMin) {
    settings.ratingMin = settings.ratingMax;
  }
  syncRatingRange();
});

// Board config handlers
optVisibility.addEventListener('change', () => {
  settings.arrowVisibility = optVisibility.value as ArrowVisibility;
  saveSettings(settings);
  showSaved();
});

optColor.addEventListener('change', () => {
  settings.arrowColorMode = optColor.value as ArrowColorMode;
  saveSettings(settings);
  showSaved();
});

optBoard.addEventListener('change', () => {
  settings.boardVisibility = optBoard.value as BoardVisibility;
  saveSettings(settings);
  showSaved();
});

// Generate tick marks for the range slider
const ticksEl = document.getElementById('range-ticks')!;
const rangeMin = 400;
const rangeMax = 3000;
for (let v = rangeMin; v <= rangeMax; v += 100) {
  const pct = ((v - rangeMin) / (rangeMax - rangeMin)) * 100;
  const tick = document.createElement('div');
  tick.className = 'range-tick';
  tick.style.left = `${pct}%`;

  const label = document.createElement('span');
  label.className = 'range-tick-label';
  label.textContent = String(v);
  tick.appendChild(label);

  ticksEl.appendChild(tick);
}
