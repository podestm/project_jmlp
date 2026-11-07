import { describe, expect, it } from 'vitest';
import { ageRange, categoryLabel, mirrorSex, sexLabel, sortCategories } from './categories.js';

describe('kategorie', () => {
  it('řadí od nejmladších, pak mix, muži, ženy – bez mutace', () => {
    const input = [
      { id: 1, max_birth_year: 2006, sex: 2 },
      { id: 2, max_birth_year: 2022, sex: 1 },
      { id: 3, max_birth_year: 2022, sex: 0 },
    ];
    expect(sortCategories(input).map((c) => c.id)).toEqual([3, 2, 1]);
    expect(input[0].id).toBe(1);
  });

  it('texty a zrcadlení', () => {
    expect(sexLabel(2)).toBe('Ženy');
    expect(sexLabel('1')).toBe('Muži');
    expect(categoryLabel({ name: 'U8', display_name: '' })).toBe('U8');
    expect(ageRange({ min_birth_year: 2020, max_birth_year: 2022 }, 2026)).toBe('4 – 6 let');
    expect(mirrorSex(1)).toBe(2);
    expect(mirrorSex(0)).toBeNull();
  });
});
