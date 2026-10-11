import { describe, expect, it } from 'vitest';
import {
  appliedLabels, bulkConfirmable, changeLabels, filterPairs, formatSyncTime, pairTone, pairWarnings, syncProgress
} from './slcrPairing.js';

const pair = (overrides = {}) => ({
  racer_id: 1,
  status: 'suggested',
  confidence: 'high',
  racer: { surname: 'Fabiánová', name: 'Ema', year: 2019, club: 'Ski team Victoria Brno', slcr_id: '891586' },
  slcr: { member_id: 44319, surname: 'Fabiánová', name: 'Emma', club: 'Ski klub Victoria Brno', race_code: 891586 },
  flags: {},
  ...overrides
});

describe('párování se SLČR', () => {
  it('upozornění: jiné ID a duplicita', () => {
    const item = pair({
      racer: { ...pair().racer, slcr_id: '778975' },
      slcr: { ...pair().slcr, race_code: 778475 },
      flags: { code_mismatch: true, shared_member: true }
    });
    const texts = pairWarnings(item).map((w) => w.text);
    expect(texts[0]).toBe('ID závodníka je jiné (u nás 778975, v evidenci 778475) - ověřte, že jde o stejného člověka');
    expect(texts).toHaveLength(2);
  });

  it('popis změn podle evidence a převzatých údajů', () => {
    const item = pair({
      changes: [
        { field: 'name', label: 'jméno', old: 'Ema', new: 'Emma' },
        { field: 'slcr_id', label: 'ID závodníka', old: null, new: '891586' }
      ],
      applied: [{ field: 'year', label: 'ročník', old: 2016 }]
    });
    expect(changeLabels(item)).toEqual(['jméno Ema → Emma', 'ID závodníka – → 891586']);
    expect(appliedLabels(item)).toEqual(['ročník bylo 2016']);
  });

  it('hledá bez diakritiky v obou jménech i ID', () => {
    const items = [pair(), pair({ racer_id: 2, racer: { ...pair().racer, surname: 'Novák', name: 'Jan', slcr_id: null }, slcr: null })];
    expect(filterPairs(items, { query: 'fabianova emma' }).map((i) => i.racer_id)).toEqual([1]);
    expect(filterPairs(items, { query: '891586' }).map((i) => i.racer_id)).toEqual([1]);
    expect(filterPairs(items, { query: 'novak' }).map((i) => i.racer_id)).toEqual([2]);
    expect(filterPairs(items, { confidence: 'medium' })).toEqual([]);
  });

  it('hromadně jen jisté shody bez upozornění', () => {
    const items = [
      pair(),
      pair({ racer_id: 2, confidence: 'medium' }),
      pair({ racer_id: 3, flags: { code_mismatch: true } }),
      pair({ racer_id: 4, flags: { shared_member: true } }),
      pair({ racer_id: 5, status: 'confirmed' }),
      pair({ racer_id: 6, changes: [{ field: 'year', label: 'ročník', old: 2016, new: 2022 }] }),
      pair({ racer_id: 7, changes: [{ field: 'name', label: 'jméno', old: 'Ema', new: 'Emma' }] })
    ];
    expect(bulkConfirmable(items).map((i) => i.racer_id)).toEqual([1, 7]);
  });

  it('barva řádku podle jistoty, bez shody šedá', () => {
    expect(pairTone(pair())).toBe('high');
    expect(pairTone(pair({ confidence: 'low' }))).toBe('low');
    expect(pairTone(pair({ confidence: null, slcr: null, status: 'not_found' }))).toBe('none');
  });

  it('průběh načítání a čas posledního načtení', () => {
    expect(syncProgress({ done: 140, total: 325 })).toBeCloseTo(43.08, 1);
    expect(syncProgress({ done: 0, total: 0 })).toBe(5);
    expect(formatSyncTime(null)).toBe('—');
    expect(formatSyncTime('2026-09-23T16:05:00')).toMatch(/23\. 9\. 2026/);
  });
});
