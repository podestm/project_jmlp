import { describe, expect, it } from 'vitest';
import { changeLabels, filterFilled } from './slcrPairing.js';

const item = (overrides = {}) => ({
  racer_id: 1,
  racer: { surname: 'Valeská', name: 'Viktorie', year: 2019, slcr_id: '890521' },
  slcr: { member_id: 42073, surname: 'Valeská', name: 'Viktorie', race_code: 890521 },
  changes: [{ field: 'slcr_id', label: 'ID závodníka', old: '-', new: '890521' }],
  ...overrides
});

describe('doplnění ID ze SLČR', () => {
  it('popis změny', () => {
    expect(changeLabels(item())).toEqual(['ID závodníka - → 890521']);
    expect(changeLabels(item({ changes: [{ field: 'slcr_id', label: 'ID závodníka', old: null, new: '1' }] })))
      .toEqual(['ID závodníka – → 1']);
  });

  it('hledá bez diakritiky ve jménu i ID', () => {
    const items = [item(), item({ racer_id: 2, racer: { surname: 'Novák', name: 'Jan', year: 2010, slcr_id: '700001' }, slcr: null })];
    expect(filterFilled(items, 'valeska').map((i) => i.racer_id)).toEqual([1]);
    expect(filterFilled(items, '700001').map((i) => i.racer_id)).toEqual([2]);
    expect(filterFilled(items, '')).toHaveLength(2);
  });
});
