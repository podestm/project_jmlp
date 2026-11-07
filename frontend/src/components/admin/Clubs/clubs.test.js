import { describe, expect, it } from 'vitest';
import { clubCounts, deletedMessage, filterClubs, PLATNOST } from './clubs.js';

const CLUBS = [
  { name: 'SK Olešnice', valid: true, organized_races_count: 3, has_logo: false },
  { name: 'SK Zaniklý', valid: false, organized_races_count: 0, has_logo: true },
];

describe('kluby', () => {
  it('filtr kombinuje hledání, platnost a pořadatele', () => {
    expect(
      filterClubs(CLUBS, { query: '', onlyOrganizers: true, platnost: PLATNOST.vse }),
    ).toHaveLength(1);
    expect(
      filterClubs(CLUBS, { query: 'zanik', onlyOrganizers: false, platnost: PLATNOST.neplatne }),
    ).toEqual([CLUBS[1]]);
    expect(
      filterClubs(CLUBS, { query: 'zanik', onlyOrganizers: false, platnost: PLATNOST.platne }),
    ).toEqual([]);
  });

  it('počty a hláška po smazání', () => {
    expect(clubCounts(CLUBS)).toEqual({ total: 2, organizers: 1, withLogo: 1, invalid: 1 });
    expect(deletedMessage({ name: 'X', moved_racers: 0, moved_races: 0 })).toBe(
      'Klub X byl smazán.',
    );
    expect(
      deletedMessage({ name: 'X', moved_racers: 4, moved_races: 1, reassigned_to_name: 'Y' }),
    ).toBe('Klub X byl smazán. Závodníci (4) i pořádané závody (1) přešli na klub Y.');
  });
});
