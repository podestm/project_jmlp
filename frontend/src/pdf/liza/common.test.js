import { describe, expect, it } from 'vitest';
import { cupTitle, formatDiff, formatLongDate, formatShortDate, formatTime } from './common.js';

describe('formáty jako v LiZe', () => {
  it('čas s desetinnou čárkou, od minuty s minutami', () => {
    expect(formatTime(30.27)).toBe('30,27');
    expect(formatTime(0.5)).toBe('0,50');
    expect(formatTime(79.87)).toBe('01:19,87');
    expect(formatTime(86.1)).toBe('01:26,10');
    expect(formatTime(147.09)).toBe('02:27,09');
    expect(formatTime(null)).toBe('');
  });

  it('ztráta na vítěze se znaménkem plus', () => {
    expect(formatDiff(2.1)).toBe('+2,10');
    expect(formatDiff(115.6)).toBe('+115,60');
    expect(formatDiff(null)).toBe('');
  });

  it('datum dlouhé pro startovku, krátké pro výsledky', () => {
    expect(formatLongDate('2026-10-03')).toBe('03.10.2026');
    expect(formatShortDate('2026-02-07')).toBe('07.02.26');
    expect(formatLongDate(null)).toBe('');
  });

  it('název poháru s ročníkem', () => {
    expect(cupTitle({ cupName: 'Jihomoravský lyžařský pohár', editionLabel: 'XX.' }))
      .toBe('Jihomoravský lyžařský pohár - XX.ročník');
  });
});
