import { describe, expect, it } from 'vitest';
import {
  categoryLabel,
  findRaceNumberOption,
  getRaceNumberValidationError,
  groupEntriesByCategory,
  resolveCategoryPreview,
  sortStartListEntries
} from './startListHelpers.js';

const entry = (overrides) => ({
  id: 1,
  category_rank: 1,
  start_number: 1,
  race_number_display: null,
  racer_name: 'Jan',
  racer_surname: 'Novák',
  ...overrides
});

const OPTIONS = [
  { display_number: 11 },
  { display_number: 12 },
  { display_number: 13 }
];

describe('sortStartListEntries', () => {
  it('řadí podle pořadí kategorie, pak startovního čísla, pak id', () => {
    const sorted = sortStartListEntries([
      entry({ id: 3, category_rank: 2, start_number: 1 }),
      entry({ id: 1, category_rank: 1, start_number: 2 }),
      entry({ id: 2, category_rank: 1, start_number: 1 })
    ]);

    expect(sorted.map((e) => e.id)).toEqual([2, 1, 3]);
  });

  it('záznamy bez kategorie a čísla jdou nakonec', () => {
    const sorted = sortStartListEntries([
      entry({ id: 1, category_rank: null, start_number: null }),
      entry({ id: 2, category_rank: 1, start_number: 5 })
    ]);

    expect(sorted[0].id).toBe(2);
  });

  it('vstupní pole nemění', () => {
    const input = [entry({ id: 2, start_number: 2 }), entry({ id: 1, start_number: 1 })];
    sortStartListEntries(input);
    expect(input[0].id).toBe(2);
  });
});

describe('findRaceNumberOption', () => {
  it('najde číslo bez ohledu na typ hodnoty', () => {
    expect(findRaceNumberOption(OPTIONS, '12')).toEqual({ display_number: 12 });
    expect(findRaceNumberOption(OPTIONS, 12)).toEqual({ display_number: 12 });
  });

  it('neexistující nebo prázdné číslo vrací null', () => {
    expect(findRaceNumberOption(OPTIONS, 99)).toBeNull();
    expect(findRaceNumberOption(OPTIONS, '')).toBeNull();
    expect(findRaceNumberOption(OPTIONS, null)).toBeNull();
  });
});

describe('getRaceNumberValidationError', () => {
  it('volné a existující číslo projde', () => {
    expect(getRaceNumberValidationError(12, { options: OPTIONS, entries: [] })).toBe('');
  });

  it('prázdné číslo se nekontroluje - dres přidělí až rozhodčí', () => {
    expect(getRaceNumberValidationError('', { options: OPTIONS })).toBe('');
  });

  it('neexistující číslo odmítne', () => {
    expect(getRaceNumberValidationError(99, { options: OPTIONS, entries: [] }))
      .toBe('St. číslo 99 neexistuje nebo je neaktivní');
  });

  it('obsazené číslo pojmenuje závodníka, který ho má', () => {
    const entries = [entry({ id: 5, race_number_display: 12, racer_surname: 'Svoboda', racer_name: 'Petr' })];

    expect(getRaceNumberValidationError(12, { options: OPTIONS, entries }))
      .toBe('St. číslo 12 už má Svoboda Petr');
  });

  it('při opravě záznamu jeho vlastní číslo konflikt nedělá', () => {
    const entries = [entry({ id: 5, race_number_display: 12 })];

    expect(getRaceNumberValidationError(12, { options: OPTIONS, entries, excludeEntryId: 5 })).toBe('');
  });

  it('vlastní číslo projde, i když už mezi aktivními není', () => {
    // Sada dresů se mohla vyměnit; zablokovat uložení kvůli tomu by znamenalo,
    // že se závodník nedá opravit vůbec.
    const entries = [entry({ id: 5, race_number_display: 77 })];

    expect(getRaceNumberValidationError(77, { options: OPTIONS, entries, excludeEntryId: 5 })).toBe('');
  });

  it('bez kontextu nespadne', () => {
    expect(getRaceNumberValidationError(12)).toBe('St. číslo 12 neexistuje nebo je neaktivní');
  });
});

describe('resolveCategoryPreview', () => {
  const CATEGORIES = [
    { name: 'Žáci', sex: 1, sex_label: 'Muži', min_birth_year: 2010, max_birth_year: 2015 },
    { name: 'Žákyně', sex: 2, sex_label: 'Ženy', min_birth_year: 2010, max_birth_year: 2015 },
    { name: 'Open', sex: 0, sex_label: 'Mix', min_birth_year: 1950, max_birth_year: 2009 }
  ];

  it('vybere kategorii podle ročníku a pohlaví', () => {
    expect(resolveCategoryPreview(CATEGORIES, 2012, 1, 'čeká')).toBe('Žáci - Muži');
    expect(resolveCategoryPreview(CATEGORIES, 2012, 2, 'čeká')).toBe('Žákyně - Ženy');
  });

  it('u Mix kategorie nepřipojuje pohlaví', () => {
    expect(resolveCategoryPreview(CATEGORIES, 1990, 1, 'čeká')).toBe('Open');
  });

  it('bez ročníku nebo pohlaví vrací průběžný text', () => {
    expect(resolveCategoryPreview(CATEGORIES, '', 1, 'čeká')).toBe('čeká');
    expect(resolveCategoryPreview(CATEGORIES, 2012, '', 'čeká')).toBe('čeká');
    expect(resolveCategoryPreview([], 2012, 1, 'čeká')).toBe('čeká');
  });

  it('když nic nesedí, vrátí vlastní text obrazovky', () => {
    expect(resolveCategoryPreview(CATEGORIES, 2030, 1, 'čeká', 'bez kategorie')).toBe('bez kategorie');
  });

  it('nečíselný ročník nespadne', () => {
    expect(resolveCategoryPreview(CATEGORIES, 'abc', 1, 'čeká')).toBe('čeká');
  });
});

describe('categoryLabel', () => {
  it('používá oficiální název z adminu, ne kódové označení', () => {
    expect(categoryLabel({
      code: 'U10', display_name: 'Myšáci dívky', sex_label: 'Ženy'
    })).toBe('Myšáci dívky');
  });

  it('bez názvu se složí kód a pohlaví', () => {
    expect(categoryLabel({ code: 'U10', name: 'U10', sex_label: 'Ženy' })).toBe('U10 - Ženy');
    expect(categoryLabel({ code: 'OPEN', name: 'OPEN', sex_label: 'Mix' })).toBe('OPEN');
  });

  it('prázdný vstup nespadne', () => {
    expect(categoryLabel(null)).toBe('');
    expect(categoryLabel({})).toBe('');
  });
});

describe('groupEntriesByCategory', () => {
  it('seskupí po kategoriích v pořadí startu', () => {
    const groups = groupEntriesByCategory([
      entry({ id: 3, category_id: 2, category_name: 'OPEN muži', category_rank: 3, start_number: 9 }),
      entry({ id: 2, category_id: 1, category_name: 'U10 dívky', category_rank: 0, start_number: 2 }),
      entry({ id: 1, category_id: 1, category_name: 'U10 dívky', category_rank: 0, start_number: 1 })
    ]);

    expect(groups.map((group) => group.category_name)).toEqual(['U10 dívky', 'OPEN muži']);
    expect(groups[0].entries.map((e) => e.id)).toEqual([1, 2]);
    expect(groups[1].entries).toHaveLength(1);
  });

  it('řádek bez kategorie skončí ve vlastní skupině na konci', () => {
    const groups = groupEntriesByCategory([
      entry({ id: 1, category_id: null, category_name: null, category_rank: null }),
      entry({ id: 2, category_id: 1, category_name: 'U10 dívky', category_rank: 0 })
    ]);

    expect(groups.map((group) => group.category_name)).toEqual(['U10 dívky', 'Bez kategorie']);
  });

  it('prázdná listina dá prázdný seznam', () => {
    expect(groupEntriesByCategory([])).toEqual([]);
  });
});
