import { describe, expect, it } from 'vitest';
import { seasonInfo } from './siteInfo.js';

describe('seasonInfo', () => {
  it('sezóna 2026 s XX. ročníkem', () => {
    expect(seasonInfo({ seasonId: 2026, edition: 20 }, new Date(2026, 9, 11))).toEqual({
      edition: 'XX.',
      season: '2026/27',
      copyright: '© 2006–2026 Jihomoravský lyžařský pohár',
    });
  });

  it('ročník bere ze sezóny, ne z data', () => {
    const info = seasonInfo({ seasonId: 2025, edition: 19 }, new Date(2026, 9, 11));
    expect(info.edition).toBe('XIX.');
    expect(info.season).toBe('2025/26');
  });
});
