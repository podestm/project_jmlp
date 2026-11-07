import { describe, expect, it } from 'vitest';
import { daysWord, formatCount, pathLabel, whenParts } from './dashboard.js';

describe('přehled administrace – pomocné funkce', () => {
  it('popisky stránek, neznámá adresa zůstane', () => {
    expect(pathLabel('/zavody')).toBe('Závody');
    expect(pathLabel('/zavod/12')).toBe('Detail závodu 12');
    expect(pathLabel('/neco')).toBe('/neco');
  });

  it('den / dny / dní', () => {
    expect([1, 2, 4, 5, 0].map(daysWord)).toEqual(['den', 'dny', 'dny', 'dní', 'dní']);
  });

  it('kdy: dnes, včera, jinak datum', () => {
    const now = new Date(2026, 8, 23, 20, 0);
    expect(whenParts(new Date(2026, 8, 23, 18, 47).toISOString(), now)).toEqual({ day: 'dnes', time: '18:47' });
    expect(whenParts(new Date(2026, 8, 22, 9, 5).toISOString(), now).day).toBe('včera');
    expect(whenParts(new Date(2026, 8, 20, 9, 5).toISOString(), now).day).toBe('20. 9.');
    expect(whenParts(null, now)).toEqual({ day: '—', time: '' });
  });

  it('počty s mezerou po tisících, chybějící jako pomlčka', () => {
    expect(formatCount(1284)).toMatch(/^1\s284$/);
    expect(formatCount(null)).toBe('—');
  });
});
