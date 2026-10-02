import { describe, expect, it } from 'vitest';
import {
  SECOND_RUN_BY_RESULTS,
  SECOND_RUN_SAME,
  clubListInput,
  resultCategories,
  secondRunEntries,
  startListCategories
} from './adapters.js';

const row = (id, overrides = {}) => ({
  id, start_number: id, race_number_actual: id, racer_surname: `P${id}`, racer_name: 'J', racer_year: 2018,
  racer_sex: 2, club_name: 'Klub', category_sex: 2, time1: null, time2: null, time_sum: null,
  dnf: false, dns: false, dsq: false, ...overrides
});

describe('2. kolo', () => {
  const entries = [
    row(1, { time1: 32 }), row(2, { time1: 30 }), row(3, { dnf: true }),
    row(4, { time1: 31, dsq: true }), row(5), row(6, { time1: 30 })
  ];

  it('kdo měl v 1. kole DSQ/DNF/DNS nebo nemá čas, nestartuje', () => {
    expect(secondRunEntries(entries, SECOND_RUN_SAME).map((e) => e.id)).toEqual([1, 2, 6]);
  });

  it('podle výsledků 1. kola: nejrychlejší první, při shodě pořadí startu', () => {
    expect(secondRunEntries(entries, SECOND_RUN_BY_RESULTS).map((e) => e.id)).toEqual([2, 6, 1]);
  });

  it('startovka 2. kola vynechá kategorii bez startujících', () => {
    const categories = [{ category_name: 'A', entries: [row(9, { dns: true })] }, { category_name: 'B', entries }];
    expect(startListCategories(categories, 2).map((c) => c.name)).toEqual(['B']);
  });
});

describe('výsledky', () => {
  it('pořadí, ztráta a body; od 30. místa po bodu', () => {
    const entries = Array.from({ length: 32 }, (_, i) => row(i + 1, { time1: 30 + i, time_sum: 30 + i }));
    const [category] = resultCategories([{ category_name: 'A', entries }], 'final');
    expect(category.entries[0]).toMatchObject({ rank: 1, points: 100, diff: null, total: 30 });
    expect(category.entries[1]).toMatchObject({ rank: 2, points: 80, diff: 1 });
    expect(category.entries[31]).toMatchObject({ rank: 32, points: 1 });
  });

  it('nedokončivší nesou stav místo pořadí', () => {
    const [category] = resultCategories([{ category_name: 'A', entries: [row(1, { dsq: true }), row(2, { time1: 30, time_sum: 30 })] }]);
    expect(category.entries.map((e) => e.rank ?? e.status)).toEqual([1, 'DSQ']);
  });
});

describe('rozpis po klubech', () => {
  it('sady a zkratky kategorií z dat', () => {
    const input = clubListInput([
      { category_name: 'Myšáci dívky', entries: [row(1, { set_number: 1 }), row(2, { set_number: 2 })] },
      { category_name: 'OPEN muži', entries: [row(3, { set_number: 1, racer_sex: 1, category_sex: 1 })] }
    ]);
    expect(input.sets).toEqual([{ number: 1, name: 'První sada' }, { number: 2, name: 'Druhá sada' }]);
    expect(input.categories).toEqual([{ code: 'MYD', name: 'Myšáci dívky' }, { code: 'OM', name: 'OPEN muži' }]);
    expect(input.entries.map((e) => e.categoryCode)).toEqual(['MYD', 'MYD', 'OM']);
  });
});
