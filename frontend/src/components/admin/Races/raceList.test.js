import { describe, expect, it } from 'vitest';
import { listSummary, orderLabel, seasonMeta, seasonOptionLabel } from './raceList.js';

describe('texty obrazovky Závody', () => {
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
