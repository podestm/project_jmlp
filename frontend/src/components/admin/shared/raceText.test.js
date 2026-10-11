import { describe, expect, it } from 'vitest';
import { methodLabel, raceSubtitle } from './raceText.js';

describe('popis závodu v administraci', () => {
  it('způsob závodu a druhý řádek', () => {
    expect(methodLabel({ race_method_id: 2 })).toBe('suchý slalom');
    expect(methodLabel({ race_method_id: 1 })).toBe('závod na sněhu');
    expect(raceSubtitle({ organizer_name: 'FreeSki', race_method_id: 2 })).toBe('FreeSki · suchý slalom');
    expect(raceSubtitle({ race_method_id: 1 })).toBe('závod na sněhu');
  });
});
