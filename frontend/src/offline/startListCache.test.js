import { beforeEach, describe, expect, it } from 'vitest';
import { timekeeperDb } from './db.js';
import { buildCacheKey, cacheGetResponse, readCachedResponse } from './startListCache.js';
import { enqueueMutation } from './syncQueue.js';
import { resetTimekeeperDb, startListEntry } from '../test/helpers.js';

const START_LIST = '/api/timekeeper/races/10/start-list';

beforeEach(resetTimekeeperDb);

describe('buildCacheKey', () => {
  it('bez parametrů je klíčem samotný endpoint', () => {
    expect(buildCacheKey('/api/timekeeper/races')).toBe('/api/timekeeper/races');
  });

  it('na pořadí parametrů nezáleží - jinak by jeden dotaz měl dva klíče', () => {
    expect(buildCacheKey('/x', { b: 2, a: 1 })).toBe(buildCacheKey('/x', { a: 1, b: 2 }));
  });
});

describe('cacheGetResponse', () => {
  it('uloží odpověď a vrátí ji', async () => {
    const data = [startListEntry()];
    const stored = await cacheGetResponse(START_LIST, null, data);

    expect(stored).toEqual(data);
    expect(await readCachedResponse(START_LIST, null)).toEqual(data);
  });

  it('naplní snímek startovky včetně race_id', async () => {
    await cacheGetResponse(START_LIST, null, [startListEntry({ race_id: undefined })]);

    expect((await timekeeperDb.startList.get(1)).race_id).toBe(10);
  });

  it('u seznamu závodů naplní tabulku závodů', async () => {
    await cacheGetResponse('/api/timekeeper/races', null, [{ id: 7, datum: '2026-01-17' }]);

    expect(await timekeeperDb.races.get(7)).toMatchObject({ id: 7 });
  });

  /**
   * Nejdůležitější test celého souboru: server o právě zadaném čase ještě neví.
   * Bez překrytí by ho odpověď na GET smazala z obrazovky.
   */
  it('nepřepíše čas, jehož zápis ještě čeká ve frontě', async () => {
    await timekeeperDb.startList.put(startListEntry({ time1: 25.5, updated_local_at: '2026-01-01T11:00:00.000Z' }));
    await enqueueMutation('PUT', '/api/timekeeper/start-list/1/time', { time1: 25.5 });

    const stored = await cacheGetResponse(START_LIST, null, [startListEntry({ time1: null })]);

    expect(stored[0].time1).toBe(25.5);
    expect(stored[0].updated_local_only).toBe(true);
    expect(stored[0].time_sum).toBe(25.5);
  });

  it('řádky bez čekajícího zápisu bere ze serveru', async () => {
    await timekeeperDb.startList.put(startListEntry({ id: 2, time1: 99 }));

    const stored = await cacheGetResponse(START_LIST, null, [startListEntry({ id: 2, time1: 30 })]);

    expect(stored[0].time1).toBe(30);
  });

  it('překrytí přenese i příznaky DNF/DNS/DSQ', async () => {
    await timekeeperDb.startList.put(startListEntry({ time1: 10, dnf: true }));
    await enqueueMutation('PUT', '/api/timekeeper/start-list/1/time', { dnf: true });

    const stored = await cacheGetResponse(START_LIST, null, [startListEntry({ time1: 10, dnf: false })]);

    expect(stored[0].dnf).toBe(true);
    expect(stored[0].time_sum).toBeNull();
  });

  it('čekající zápis na řádek, který v cache není, nic nerozbije', async () => {
    await enqueueMutation('PUT', '/api/timekeeper/start-list/999/time', { time1: 1 });

    const stored = await cacheGetResponse(START_LIST, null, [startListEntry()]);
    expect(stored[0].id).toBe(1);
  });
});

describe('readCachedResponse', () => {
  it('pro neuložený dotaz vrací null', async () => {
    expect(await readCachedResponse('/api/timekeeper/races', null)).toBeNull();
  });
});
