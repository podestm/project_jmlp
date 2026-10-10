import { describe, expect, it } from 'vitest';
import { appliedLabels, bulkConfirmable, changeLabels, filterPairs, pairWarnings } from './slcrPairing.js';

const pair = (overrides = {}) => ({
  racer_id: 1,
  status: 'suggested',
  kind: 'ok',
  racer: { surname: 'Fabiánová', name: 'Ema', year: 2019, club: 'Ski team Victoria Brno', slcr_id: '891586' },
  slcr: { member_id: 44319, surname: 'Fabiánová', name: 'Emma', club: 'Ski klub Victoria Brno', race_code: 891586 },
  flags: {},
  ...overrides
});

describe('párování se SLČR', () => {
  it('upozornění: stejný člen u dvou našich závodníků', () => {
    expect(pairWarnings(pair({ flags: { shared_member: true } })).map((w) => w.key)).toEqual(['shared']);
    expect(pairWarnings(pair())).toEqual([]);
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
    expect(filterPairs(items, { kind: 'other_id' })).toEqual([]);
  });

  it('hromadně jen jisté shody bez upozornění', () => {
    const items = [
      pair(),
      pair({ racer_id: 2, kind: 'other_id' }),
      pair({ racer_id: 3, kind: 'id_mismatch' }),
      pair({ racer_id: 4, flags: { shared_member: true } }),
      pair({ racer_id: 5, status: 'confirmed' }),
      pair({ racer_id: 6, changes: [{ field: 'year', label: 'ročník', old: 2016, new: 2022 }] }),
      pair({ racer_id: 7, changes: [{ field: 'name', label: 'jméno', old: 'Ema', new: 'Emma' }] })
    ];
    expect(bulkConfirmable(items).map((i) => i.racer_id)).toEqual([1, 7]);
  });
});
