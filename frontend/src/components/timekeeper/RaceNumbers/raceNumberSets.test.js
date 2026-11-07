import { describe, expect, it } from 'vitest';
import { activeCountOf, chunkByTen, newSetPreview, setsSummary } from './raceNumberSets.js';

describe('sady čísel', () => {
  it('po desítkách', () => {
    const rows = chunkByTen(Array.from({ length: 23 }, (_, i) => i + 1));
    expect(rows.map((row) => row.length)).toEqual([10, 10, 3]);
  });

  it('náhled nové sady', () => {
    expect(newSetPreview({ set_number: '2', actual_from: '1', actual_to: '200' })).toEqual({
      actualFrom: '1',
      actualTo: '200',
      displayFrom: 'B1',
      displayTo: 'B200',
      count: 200,
    });
    expect(newSetPreview({ set_number: '1', actual_from: '1', actual_to: '' })).toBeNull();
  });

  it('souhrn a aktivní čísla', () => {
    const sets = [{ count: 60, active_count: 58 }, { count: 60 }];
    expect(activeCountOf(sets[1])).toBe(60);
    expect(setsSummary(sets)).toEqual({ sets: 2, total: 120, active: 118 });
  });
});
