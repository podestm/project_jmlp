import { describe, expect, it } from 'vitest';
import { buildLocalEntry, searchRacers } from './racerRegistry.js';

const registry = [
  { id: 1, name: 'Anna', surname: 'Holčická', year: 2017, sex: 2, club_name: 'SK', slcr_id: '891586' },
  { id: 2, name: 'Jan', surname: 'Novák', year: 2010, sex: 1, club_name: 'TJ', slcr_id: null },
];

describe('offline hledání v lokálním registru', () => {
  it('jméno, příjmení i "příjmení jméno" bez ohledu na diakritiku, a ID', () => {
    expect(searchRacers(registry, 'holcicka').map((r) => r.id)).toEqual([1]);
    expect(searchRacers(registry, 'Novák Jan').map((r) => r.id)).toEqual([2]);
    expect(searchRacers(registry, '8915').map((r) => r.id)).toEqual([1]);
    expect(searchRacers(registry, 'a')).toEqual([]);
  });

  it('po slovech v libovolném pořadí, i neúplná slova', () => {
    const more = [...registry, { id: 3, name: 'Radka', surname: 'More', year: 1980, sex: 2, slcr_id: '806816' }];
    expect(searchRacers(more, 'Mor Radka').map((r) => r.id)).toEqual([3]);
    expect(searchRacers(more, 'radka more').map((r) => r.id)).toEqual([3]);
    expect(searchRacers(more, 'More Jan')).toEqual([]);
  });
});

describe('řádek startovky pro offline přidaného závodníka', () => {
  const categories = [
    { id: 8, name: 'Přípravka dívky', display_name: 'Přípravka dívky', min_birth_year: 2017, max_birth_year: 2018, sex: 2 },
    { id: 7, name: 'Přípravka chlapci', display_name: 'Přípravka chlapci', min_birth_year: 2017, max_birth_year: 2018, sex: 1 },
  ];
  const raceNumberOptions = [{ id: 312, display_number: 'A12', actual_number: 12, set_number: 1, set_color: 'rose' }];
  const startList = [
    { id: 1, start_number: 4, category_id: 8, category_rank: 3 },
    { id: 2, start_number: 9, category_id: 7, category_rank: 4 },
  ];

  it('kategorie podle ročníku a pohlaví, další startovní číslo, dres podle systémového čísla', () => {
    const entry = buildLocalEntry({
      tempId: -5,
      raceId: '133',
      payload: { racer_name: 'Nova', racer_surname: 'Offline', racer_year: '2017', racer_sex: '2', club_name: 'SK', race_number_display: 'a12' },
      startList,
      categories,
      raceNumberOptions,
    });
    expect(entry).toMatchObject({
      id: -5, race_id: 133, category_id: 8, category_name: 'Přípravka dívky', category_rank: 3,
      start_number: 10, race_number_display: 'A12', race_number_actual: 12, race_number_id: 312, set_color: 'rose',
      time1: null, excluded: false,
    });
  });
});
