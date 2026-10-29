export const TIMER_SECONDS = 30 * 60;

/** "30:00", "04:07", "00:00". Negative input is clamped to zero. */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export interface Timer {
  start(): void;
  stop(): void;
  reset(): void;
}

/**
 * Countdown that the user starts by hand. The end time is an absolute timestamp,
 * so background-tab throttling of setInterval does not make it drift.
 */
export function createTimer(
  display: HTMLElement,
  startBtn: HTMLButtonElement,
  seconds: number = TIMER_SECONDS,
): Timer {
  let endAt = 0;
  let handle: number | null = null;
  const baseTitle = document.title;

  function render(remaining: number): void {
    display.textContent = formatTime(remaining);
    display.classList.toggle('timer-low', remaining > 0 && remaining <= 60);
    display.classList.toggle('timer-done', remaining <= 0);
    document.title = handle !== null ? `${formatTime(remaining)} – ${baseTitle}` : baseTitle;
  }

  function tick(): void {
    const remaining = (endAt - Date.now()) / 1000;
    if (remaining <= 0) {
      halt();
      render(0);
      display.title = "Time's up";
      startBtn.textContent = 'Restart timer';
      return;
    }
    render(remaining);
  }

  function halt(): void {
    if (handle !== null) window.clearInterval(handle);
    handle = null;
  }

  function start(): void {
    halt();
    endAt = Date.now() + seconds * 1000;
    handle = window.setInterval(tick, 250);
    startBtn.textContent = 'Stop timer';
    display.title = '';
    tick();
  }

  function stop(): void {
    halt();
    startBtn.textContent = 'Start timer';
    document.title = baseTitle;
  }

  function reset(): void {
    stop();
    render(seconds);
    display.classList.remove('timer-done', 'timer-low');
    display.title = '';
  }

  startBtn.addEventListener('click', () => (handle === null ? start() : stop()));
  reset();
  return { start, stop, reset };
}
