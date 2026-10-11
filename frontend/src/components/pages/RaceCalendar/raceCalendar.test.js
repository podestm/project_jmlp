import { describe, expect, it } from 'vitest';
import { matchesFilter, seasonLabel, seasonsOf, seasonSummary, splitByDate } from './raceCalendar.js';

const race = (nr, datum, method = 2) => ({ race_nr: nr, datum, race_method_id: method });

describe('raceCalendar', () => {
  it('sezóny od nejnovější, bez závodů bez čísla', () => {
    expect(seasonsOf([race('JMLP2025-01'), race('JMLP2026-01'), race(null)])).toEqual([2026, 2025]);
    expect(seasonLabel(2026)).toBe('2026/27 — XX. ročník');
  });

  it('rozdělí závody na nadcházející a odjeté', () => {
    const today = new Date(2026, 9, 5);
    const { upcoming, past } = splitByDate([race('a', '2026-10-10'), race('b', '2026-10-03'), race('c', '2026-10-05')], today);
    expect(upcoming.map((r) => r.race_nr)).toEqual(['c', 'a']);
    expect(past.map((r) => r.race_nr)).toEqual(['b']);
  });

  it('filtr podle typu a souhrn', () => {
    expect(matchesFilter(race('a', null, 1), 'snow')).toBe(true);
    expect(matchesFilter(race('a', null, 2), 'snow')).toBe(false);
    expect(seasonSummary({ upcoming: [1, 2], past: [] })).toBe('Sezóna právě začíná · 2 vypsané závody');
    expect(seasonSummary({ upcoming: [], past: [1] })).toBe('Sezóna skončila · 1 závod');
    expect(seasonSummary({ upcoming: [1], past: [1, 2] })).toBe('Odjeto 2 z 3 závodů');
  });
});
