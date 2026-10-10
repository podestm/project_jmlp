import { describe, expect, it } from 'vitest';
import { bulkConfirmable, filterPairs, pairWarnings } from './slcrPairing.js';

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
  it('upozornění: nesouhlasící a chybějící ID, jiný zápis jména a ročník, duplicita', () => {
    const item = pair({
      racer: { ...pair().racer, slcr_id: '778975' },
      slcr: { ...pair().slcr, race_code: 778475 },
      flags: { code_mismatch: true, name_differs: true, shared_member: true }
    });
    const texts = pairWarnings(item).map((w) => w.text);
    expect(texts[0]).toBe('ID závodníka nesouhlasí (u nás 778975, v evidenci 778475)');
    expect(texts).toContain('V evidenci se píše Fabiánová Emma - výsledky se v SLČR nespárují');
    expect(texts).toHaveLength(3);
    const year = pairWarnings(pair({ racer: { ...pair().racer, year: 2016 }, slcr: { ...pair().slcr, year: 2022 }, flags: { year_differs: true } }));
    expect(year[0].text).toBe('Ročník v evidenci je 2022 (u nás 2016) - výsledky se v SLČR nespárují');
    expect(pairWarnings(pair({ racer: { ...pair().racer, slcr_id: null }, flags: { code_missing: true } }))[0].text)
      .toBe('ID závodníka u nás chybí (v evidenci 891586)');
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
      pair({ racer_id: 5, status: 'confirmed' })
    ];
    expect(bulkConfirmable(items).map((i) => i.racer_id)).toEqual([1]);
  });
});
