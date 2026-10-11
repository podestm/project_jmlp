import { describe, expect, it } from 'vitest';
import { currentSeasonInfo } from './siteInfo.js';

describe('currentSeasonInfo', () => {
  it('v říjnu 2026 je XX. ročník, sezóna 2026/27', () => {
    expect(currentSeasonInfo(new Date(2026, 9, 11))).toEqual({
      edition: 'XX.',
      season: '2026/27',
      copyright: '© 2006–2026 Jihomoravský lyžařský pohár',
    });
  });

  it('v červenci 2027 je to pořád sezóna 2026/27', () => {
    expect(currentSeasonInfo(new Date(2027, 6, 31)).season).toBe('2026/27');
  });
});
