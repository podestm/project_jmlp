import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/timekeeperApi.js', () => ({ TimekeeperAPI: { get: vi.fn(async () => ({})) } }));
const { TimekeeperAPI } = await import('../config/timekeeperApi.js');
const { preloadRaceData, raceEndpoints } = await import('./racePreload.js');

describe('preloadRaceData', () => {
  beforeEach(() => TimekeeperAPI.get.mockClear());

  it('online stáhne do zařízení detail, startovku i výsledky vybraného závodu', async () => {
    await preloadRaceData('129');
    expect(TimekeeperAPI.get.mock.calls.map(([url]) => url)).toEqual(raceEndpoints('129'));
    expect(raceEndpoints('129')).toContain('/api/timekeeper/races/129/detail');
  });

  it('bez závodu nebo bez signálu nic nestahuje', async () => {
    await preloadRaceData('');
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await preloadRaceData('129');
    online.mockRestore();
    expect(TimekeeperAPI.get).not.toHaveBeenCalled();
  });
});
