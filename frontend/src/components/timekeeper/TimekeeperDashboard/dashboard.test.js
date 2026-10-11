import { describe, expect, it } from 'vitest';
import { isRaceToday, splitRaces } from './dashboard.js';

const today = new Date(2026, 9, 3);

describe('výběr závodu', () => {
  it('nadcházející od nejbližšího, proběhlé od nejnovějšího, dnešek je nadcházející', () => {
    const races = [
      { id: 1, datum: '2026-10-10' },
      { id: 2, datum: '2026-10-03' },
      { id: 3, datum: '2026-03-01' },
      { id: 4, datum: '2026-09-01' },
      { id: 5, datum: null },
    ];
    const { upcoming, past } = splitRaces(races, today);
    expect(upcoming.map((r) => r.id)).toEqual([2, 1]);
    expect(past.map((r) => r.id)).toEqual([4, 3, 5]);
  });

  it('dnešní závod', () => {
    expect(isRaceToday({ datum: '2026-10-03' }, today)).toBe(true);
    expect(isRaceToday({ datum: '2026-10-04' }, today)).toBe(false);
    expect(isRaceToday({ datum: null }, today)).toBe(false);
  });
});
