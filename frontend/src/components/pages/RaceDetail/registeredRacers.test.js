import { describe, expect, it } from 'vitest';
import { countRacers, filterClubs, racerCategoryOptions, racerClubOptions } from './registeredRacers.js';

const racer = (lastName, category) => ({ firstName: 'X', lastName, category_id: category?.id ?? null, category_name: category?.name ?? null });
const DIVKY = { id: 8, name: 'Přípravka dívky' };
const CHLAPCI = { id: 7, name: 'Přípravka chlapci' };

const REGISTRATIONS = {
  total_racers: 4,
  categories: [DIVKY, CHLAPCI],
  clubs: [
    { club_name: 'SK Brno', racers: [racer('Anna', DIVKY), racer('Petr', CHLAPCI)] },
    { club_name: 'Bez klubu', racers: [racer('Eva', DIVKY), racer('Bez', null)] },
  ],
};

const names = (clubs) => clubs.flatMap((club) => club.racers.map((r) => r.lastName));

describe('filtr přihlášených', () => {
  it('kluby abecedně, kategorie v pořadí ze serveru a Bez kategorie na konci', () => {
    expect(racerClubOptions(REGISTRATIONS.clubs)).toEqual(['Bez klubu', 'SK Brno']);
    expect(racerCategoryOptions(REGISTRATIONS)).toEqual([
      { value: '8', label: 'Přípravka dívky' },
      { value: '7', label: 'Přípravka chlapci' },
      { value: 'none', label: 'Bez kategorie' },
    ]);
  });

  it('Bez kategorie jen když je někdo bez kategorie', () => {
    const clubs = [{ club_name: 'SK Brno', racers: [racer('Anna', DIVKY)] }];
    expect(racerCategoryOptions({ categories: [DIVKY], clubs })).toEqual([{ value: '8', label: 'Přípravka dívky' }]);
  });

  it('filtruje podle klubu i kategorie, prázdné kluby vypadnou', () => {
    const { clubs } = REGISTRATIONS;
    expect(names(filterClubs(clubs, { club: '', category: '' }))).toEqual(['Anna', 'Petr', 'Eva', 'Bez']);
    expect(names(filterClubs(clubs, { club: '', category: '8' }))).toEqual(['Anna', 'Eva']);
    expect(names(filterClubs(clubs, { club: 'SK Brno', category: '8' }))).toEqual(['Anna']);
    expect(filterClubs(clubs, { club: '', category: 'none' }).map((c) => c.club_name)).toEqual(['Bez klubu']);
    expect(countRacers(filterClubs(clubs, { club: '', category: '7' }))).toBe(1);
  });
});
