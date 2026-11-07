import { describe, expect, it } from 'vitest';
import { emptyFilterTitle, matchesFilter, splitByDate } from './raceCalendar.js';
import { seasonLabel, seasonsOf } from '../../../utils/races.js';

const race = (nr, datum, method = 2) => ({ race_nr: nr, datum, race_method_id: method });

describe('raceCalendar', () => {
  it('sezóny od nejnovější, bez závodů bez čísla', () => {
    expect(seasonsOf([race('JMLP2025-01'), race('JMLP2026-01'), race(null)])).toEqual([2026, 2025]);
    expect(seasonLabel(2026)).toBe('2026/27 — XX. ročník');
  });

  it('rozdělí závody na nadcházející a odjeté', () => {
    const today = new Date(2026, 9, 5);
    const { upcoming, past } = splitByDate(
      [race('a', '2026-10-10'), race('b', '2026-10-03'), race('c', '2026-10-05')],
      today,
    );
    expect(upcoming.map((r) => r.race_nr)).toEqual(['c', 'a']);
    expect(past.map((r) => r.race_nr)).toEqual(['b']);
  });

  it('filtr podle typu', () => {
    expect(matchesFilter(race('a', null, 1), 'snow')).toBe(true);
    expect(matchesFilter(race('a', null, 2), 'snow')).toBe(false);
  });

  it('prázdný filtr v aktuální nebo budoucí sezóně neříká, že se nezávodí, jen že závody zatím nejsou', () => {
    expect(emptyFilterTitle('snow', 2026, 2026)).toBe('Závody na sněhu zatím nejsou vypsané');
    expect(emptyFilterTitle('dry', 2026, 2026)).toBe('Suché závody zatím nejsou vypsané');
    expect(emptyFilterTitle('snow', 2027, 2026)).toBe('Závody na sněhu zatím nejsou vypsané');
  });

  it('prázdný filtr v proběhlé sezóně mluví v minulém čase', () => {
    expect(emptyFilterTitle('snow', 2024, 2026)).toBe('V sezóně 2024/25 se na sněhu nezávodilo');
    expect(emptyFilterTitle('dry', 2024, 2026)).toBe('V sezóně 2024/25 se suchý závod nekonal');
  });
});
