import { describe, expect, it } from 'vitest';
import { formatLoss, hasAnyResult, sharedRanks } from './resultsView.js';

describe('výsledky v časomíře', () => {
  it('ztráta: vítěz, plus na vítěze, bez času pomlčka', () => {
    expect(formatLoss({ display_rank: 1, display_diff: null })).toBe('vítěz');
    expect(formatLoss({ display_rank: 2, display_diff: 0.523 })).toBe('+0.52');
    expect(formatLoss({ display_rank: null, display_diff: null })).toBe('—');
  });

  it('dělená místa', () => {
    expect([...sharedRanks([{ display_rank: 1 }, { display_rank: 4 }, { display_rank: 4 }, { display_rank: null }, { display_rank: null }])]).toEqual([4]);
  });

  it('kategorie bez jediného času', () => {
    expect(hasAnyResult([{ time1: null, time2: null, time_sum: null, status: null }])).toBe(false);
    expect(hasAnyResult([{ time1: 30.1 }])).toBe(true);
    expect(hasAnyResult([{ status: 'DNS' }])).toBe(true);
  });
});
