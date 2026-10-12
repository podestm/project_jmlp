import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadRaceData, preloadSelectedRace } from './racePreload.js';
import { buildCacheKey } from './startListCache.js';
import { timekeeperDb } from './db.js';
import { resetTimekeeperDb, setOnline } from '../test/helpers.js';

const ok = (body) => ({ ok: true, status: 200, statusText: 'OK', json: async () => body });
const paths = (fetchMock) => fetchMock.mock.calls.map(([url]) => new URL(String(url), 'http://x').pathname);

beforeEach(async () => {
  await resetTimekeeperDb();
  localStorage.setItem('auth_token', 'token-pro-test');
  setOnline(true);
});
afterEach(() => {
  setOnline(true);
  localStorage.removeItem('timekeeper_selected_race');
  vi.unstubAllGlobals();
});

describe('přednačtení dat závodu do zařízení', () => {
  it('stáhne závody, detail, startovku, výsledky i sady čísel a uloží je do keše', async () => {
    const fetchMock = vi.fn(async () => ok({ runs: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await preloadRaceData(7);

    expect(paths(fetchMock).sort()).toEqual([
      '/api/timekeeper/race-number-sets',
      '/api/timekeeper/races',
      '/api/timekeeper/races/7/detail',
      '/api/timekeeper/races/7/results',
      '/api/timekeeper/races/7/start-list',
    ]);
    const detail = await timekeeperDb.cache.get(buildCacheKey('/api/timekeeper/races/7/detail', {}));
    expect(detail?.data).toEqual({ runs: [] });
  });

  it('jedna chyba nezastaví ostatní', async () => {
    const fetchMock = vi.fn(async (url) => (String(url).includes('/results')
      ? { ok: false, status: 500, statusText: 'Err', json: async () => ({}) }
      : ok([])));
    vi.stubGlobal('fetch', fetchMock);
    await expect(preloadRaceData(7)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('offline ani bez vybraného závodu nic nestahuje', async () => {
    const fetchMock = vi.fn(async () => ok([]));
    vi.stubGlobal('fetch', fetchMock);

    await preloadRaceData(null);
    await preloadSelectedRace();
    setOnline(false);
    await preloadRaceData(7);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('vybraný závod z tohoto zařízení', async () => {
    const fetchMock = vi.fn(async () => ok([]));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('timekeeper_selected_race', '12');

    await preloadSelectedRace();

    expect(paths(fetchMock)).toContain('/api/timekeeper/races/12/detail');
  });
});
