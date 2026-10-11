import { describe, expect, it } from 'vitest';
import { listSummary, methodLabel, orderLabel, raceSubtitle, seasonMeta, seasonOptionLabel } from './raceList.js';

describe('texty obrazovky Závody', () => {
  it('způsob závodu a druhý řádek', () => {
    expect(methodLabel({ race_method_id: 2 })).toBe('suchý slalom');
    expect(methodLabel({ race_method_id: 1 })).toBe('závod na sněhu');
    expect(raceSubtitle({ organizer_name: 'FreeSki', race_method_id: 2 })).toBe('FreeSki · suchý slalom');
    expect(raceSubtitle({ race_method_id: 1 })).toBe('závod na sněhu');
  });

  it('souhrn nad seznamem skloňuje', () => {
    expect(listSummary([{ registration: true }, { registration: false }])).toBe('2 závody · 1 s otevřenou registrací');
    expect(listSummary([])).toBe('0 závodů · 0 s otevřenou registrací');
    expect(listSummary([{ registration: false }])).toBe('1 závod · 0 s otevřenou registrací');
  });

  it('sezóna a pořadí závodu', () => {
    expect(seasonOptionLabel(2026)).toBe('Sezóna 2026/27 — XX. ročník');
    expect(seasonMeta('')).toBe('všechny sezóny');
    expect(seasonMeta('2025')).toBe('sezóna 2025/26');
    expect(orderLabel('JMLP2026-03')).toBe('3. závod sezóny');
    expect(orderLabel('')).toBeNull();
  });
});
