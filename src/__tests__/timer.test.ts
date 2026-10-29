import { describe, it, expect } from 'vitest';
import { formatTime, TIMER_SECONDS } from '../timer';

describe('formatTime', () => {
  it('formats the full duration', () => {
    expect(formatTime(TIMER_SECONDS)).toBe('30:00');
  });

  it('pads minutes and seconds', () => {
    expect(formatTime(247)).toBe('04:07');
  });

  it('rounds partial seconds up so it only shows 00:00 at the end', () => {
    expect(formatTime(0.2)).toBe('00:01');
    expect(formatTime(0)).toBe('00:00');
  });

  it('clamps negative values', () => {
    expect(formatTime(-5)).toBe('00:00');
  });
});
