import { describe, expect, it } from 'vitest';
import { activeCountOf, chunkByTen, newSetPreview, setsSummary } from './raceNumberSets.js';

describe('sady čísel', () => {
  it('po desítkách', () => {
    const rows = chunkByTen(Array.from({ length: 23 }, (_, i) => i + 1));
    expect(rows.map((row) => row.length)).toEqual([10, 10, 3]);
  });

  it('náhled nové sady', () => {
    expect(newSetPreview({ actual_from: '301', actual_to: '330', display_from: '149' }))
      .toEqual({ actualFrom: '301', actualTo: '330', displayFrom: '149', displayTo: 178, count: 30 });
    expect(newSetPreview({ actual_from: '1', actual_to: '', display_from: '1' })).toBeNull();
  });

  it('souhrn a aktivní čísla', () => {
    const sets = [{ count: 60, active_count: 58 }, { count: 60 }];
    expect(activeCountOf(sets[1])).toBe(60);
    expect(setsSummary(sets)).toEqual({ sets: 2, total: 120, active: 118 });
  });
});
