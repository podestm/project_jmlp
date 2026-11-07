import { describe, expect, it } from 'vitest';
import {
  categoryOptions,
  clubOptions,
  filterRegistrations,
  formatRegisteredAt,
  groupRegistrations,
  raceMeta,
  registrationStats,
  sexLabel,
} from './registrations.js';

const R = [
  {
    registration_id: 1,
    firstName: 'Šimon',
    lastName: 'Pokorný',
    sex: 'M',
    idSlcr: '1',
    club_name: 'Zlín',
  },
  {
    registration_id: 2,
    firstName: 'Ela',
    lastName: 'Černá',
    sex: 'Z',
    idSlcr: '',
    club_name: 'Brno',
  },
  {
    registration_id: 3,
    firstName: 'Ida',
    lastName: 'Áčková',
    sex: 'Z',
    idSlcr: null,
    club_name: 'Nový Klub',
  },
];

describe('přihlášky – čisté funkce', () => {
  it('počty', () => {
    expect(registrationStats(R)).toEqual({
      total: 3,
      men: 1,
      women: 2,
      clubs: 3,
      withoutSlcr: 2,
      waitingForClub: 1,
    });
  });

  it('kluby abecedně česky, čekající na konci', () => {
    expect(clubOptions(R)).toEqual(['Brno', 'Zlín', 'Nový Klub']);
  });

  it('hledání bez diakritiky a v obou pořadích jména', () => {
    expect(
      filterRegistrations(R, { query: 'simon pokor', club: '' }).map((r) => r.registration_id),
    ).toEqual([1]);
    expect(
      filterRegistrations(R, { query: 'CERNA', club: '' }).map((r) => r.registration_id),
    ).toEqual([2]);
    expect(
      filterRegistrations(R, { query: '', club: 'Zlín' }).map((r) => r.registration_id),
    ).toEqual([1]);
  });

  it('kategorie: pořadí závodu, Bez kategorie na konci, filtr podle klíče', () => {
    const withCategories = [
      { ...R[0], category_id: 5, category_name: 'Starší žáci', category_order: 6 },
      { ...R[1], category_id: null, category_name: null, category_order: null },
      { ...R[2], category_id: 2, category_name: 'Předžákyně', category_order: 1 },
    ];
    expect(categoryOptions(withCategories)).toEqual([
      { value: '2', label: 'Předžákyně' },
      { value: '5', label: 'Starší žáci' },
      { value: 'none', label: 'Bez kategorie' },
    ]);
    const ids = (category) =>
      filterRegistrations(withCategories, { query: '', club: '', category }).map(
        (r) => r.registration_id,
      );
    expect(ids('none')).toEqual([2]);
    expect(ids('5')).toEqual([1]);
    expect(ids('')).toEqual([1, 2, 3]);
  });

  it('skupiny podle klubu a podle příjmení', () => {
    expect(groupRegistrations(R, 'club').map((g) => g.label)).toEqual([
      'Brno',
      'Zlín',
      'Čeká na přiřazení klubu',
    ]);
    const [all] = groupRegistrations(R, 'name');
    expect(all.label).toBeNull();
    expect(all.items.map((r) => r.lastName)).toEqual(['Áčková', 'Černá', 'Pokorný']);
  });

  it('texty', () => {
    expect(formatRegisteredAt('2026-09-23T14:02:00')).toBe('23. 9. 14:02');
    expect(formatRegisteredAt(null)).toBe('');
    expect(raceMeta({ areal_name: 'Brno', datum: '2026-10-03' }, 7)).toBe('Brno, 3. 10. 2026');
    expect(raceMeta(null, 7)).toBe('#7');
    expect(sexLabel('M')).toBe('Muž');
    expect(sexLabel('')).toBe('');
  });
});
