import { describe, expect, it } from 'vitest';
import { czechPlural, defaultSeasonId, raceDate, raceMethod, raceOrder, raceSeasonId, registrationState, startOfToday } from './races.js';

const today = startOfToday(new Date('2026-10-03T15:00:00'));

describe('races', () => {
  it('stav přihlášek podle data a registrace', () => {
    expect(registrationState({ datum: '2026-10-02', registration: true }, today)).toBe('past');
    expect(registrationState({ datum: '2026-10-03', registration: true }, today)).toBe('open');
    expect(registrationState({ datum: '2026-10-10', registration: false }, today)).toBe('closed');
  });

  it('datum je místní půlnoc', () => {
    expect(raceDate({ datum: '2026-10-03' }).getDate()).toBe(3);
    expect(raceDate({})).toBeNull();
  });

  it('typ, sezóna a pořadí závodu', () => {
    expect(raceMethod({ race_method_id: 1 }).key).toBe('snow');
    expect(raceMethod({ race_method_id: 2 }).key).toBe('dry');
    expect(raceSeasonId({ race_nr: 'JMLP2026-03' })).toBe(2026);
    expect(raceOrder({ race_nr: 'JMLP2026-03' })).toBe(3);
    expect(raceOrder({ race_nr: null })).toBeNull();
  });

  it('množná čísla', () => {
    expect(czechPlural(1, ['závod', 'závody', 'závodů'])).toBe('závod');
    expect(czechPlural(3, ['závod', 'závody', 'závodů'])).toBe('závody');
    expect(czechPlural(0, ['závod', 'závody', 'závodů'])).toBe('závodů');
  });

  it('výchozí sezóna výběru je aktuální, pokud má závody', () => {
    expect(defaultSeasonId([2026, 2025], 2025)).toBe(2025);
    expect(defaultSeasonId([2025, 2024], 2026)).toBe(2025);
    expect(defaultSeasonId([], 2026)).toBe(2026);
  });
});
