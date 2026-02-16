import './settings.css';
import { loadSettings, saveSettings } from './settings';
import type { ArrowVisibility, ArrowColorMode, BoardVisibility } from './types';

const settings = loadSettings();
const optVisibility = document.getElementById('opt-arrow-visibility') as HTMLSelectElement;
const optColor = document.getElementById('opt-arrow-color') as HTMLSelectElement;
const optBoard = document.getElementById('opt-board-visibility') as HTMLSelectElement;

optVisibility.value = settings.arrowVisibility;
optColor.value = settings.arrowColorMode;
optBoard.value = settings.boardVisibility;

function showSaved() {
  const el = document.getElementById('save-status')!;
  el.textContent = 'Settings saved';
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 1500);
}

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
