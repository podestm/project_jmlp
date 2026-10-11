import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { timekeeperDb } from './db.js';
import { processSyncQueue } from './sync.js';
import { buildCacheKey, readCachedResponse } from './startListCache.js';
import { resolveConflict } from './syncQueue.js';
import {
  addLocalEntry,
  ENTRY_REMAPPED_EVENT,
  getTempEntryMap,
  isTempEntryId,
  newTempEntryId,
  remapEntriesInState,
  renameKey,
  resolveTempIds,
} from './offlineEntries.js';
import { mutationKeys } from './entryTargets.js';
import { TimekeeperAPI } from '../config/timekeeperApi.js';
import { apiError, resetTimekeeperDb, setOnline, startListEntry } from '../test/helpers.js';

const RACE = 5;
const LIST = `/api/timekeeper/races/${RACE}/start-list`;
const CREATE = `/api/timekeeper/races/${RACE}/start-list/entry`;

const serverRow = startListEntry({ id: 1, race_id: RACE, start_number: 1, racer_surname: 'Server' });

const seedCachedStartList = (rows = [serverRow]) => timekeeperDb.cache.put({
  key: buildCacheKey(LIST, {}), endpoint: LIST, params: {}, data: rows, updated_at: 'x'
});

/** Offline dohláška tak, jak ji dělá obrazovka Závodníci. */
const addOffline = async (tempId, extra = {}) => {
  const payload = {
    racer_name: 'Nova', racer_surname: 'Offline', racer_year: 2017, racer_sex: 2,
    club_name: 'SK Test', race_number_display: 12, client_temp_id: tempId, ...extra,
  };
  const result = await TimekeeperAPI.post(CREATE, payload);
  expect(result.queued).toBe(true);
  await addLocalEntry(RACE, startListEntry({
    id: tempId, race_id: RACE, start_number: 2, racer_surname: 'Offline', racer_name: 'Nova', updated_at: null,
  }));
  return payload;
};

beforeEach(async () => {
  await resetTimekeeperDb();
  setOnline(false);
});
afterEach(() => {
  setOnline(true);
  vi.unstubAllGlobals();
});

describe('dočasné id offline přidaného závodníka', () => {
  it('je záporné a jedinečné', () => {
    const a = newTempEntryId();
    const b = newTempEntryId();
    expect(isTempEntryId(a)).toBe(true);
    expect(Number.isSafeInteger(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it('přidání drží ve frontě časy i vyřazení svého dočasného id', () => {
    expect(mutationKeys('POST', CREATE, { client_temp_id: -9 })).toEqual(['entry:-9', 'excluded:-9']);
    expect(mutationKeys('PUT', '/api/timekeeper/start-list/-9/time', {})).toEqual(['entry:-9']);
    expect(mutationKeys('PUT', '/api/timekeeper/start-list/-9/excluded', {})).toEqual(['excluded:-9']);
    expect(mutationKeys('POST', `/api/timekeeper/races/${RACE}/times`, { entries: [{ entry_id: -9 }] })).toEqual(['entry:-9']);
  });

  it('překlad id v endpointu i v dávce časů', () => {
    const map = { '-9': 77 };
    expect(resolveTempIds('/api/timekeeper/start-list/-9/time', {}, map).endpoint).toBe('/api/timekeeper/start-list/77/time');
    expect(resolveTempIds('/api/timekeeper/start-list/-90/time', {}, map).changed).toBe(false);
    const batch = resolveTempIds('/api/timekeeper/races/5/times', { entries: [{ entry_id: -9 }, { entry_id: 3 }] }, map);
    expect(batch.payload.entries.map((e) => e.entry_id)).toEqual([77, 3]);
  });

  it('stav obrazovky: řádek i klíče rozepsaných časů', () => {
    const entries = [{ id: 1 }, { id: -9, racer_surname: 'X' }];
    expect(remapEntriesInState(entries, { tempId: -9, serverId: 77, entry: { id: 77, start_number: 5 } }))
      .toEqual([{ id: 1 }, { id: 77, racer_surname: 'X', start_number: 5 }]);
    expect(remapEntriesInState(entries, { tempId: -9, serverId: null, entry: null })).toEqual([{ id: 1 }]);
    expect(renameKey({ '-9': { time1: '30' } }, -9, 77)).toEqual({ 77: { time1: '30' } });
  });
});

describe('offline dohláška od přidání po synchronizaci', () => {
  it('závodník je hned ve startovce, jde mu zapsat čas i ho vyřadit, a po synchronizaci má serverové id všude', async () => {
    const tempId = -1700000000000123;
    await seedCachedStartList();
    await addOffline(tempId);
    await TimekeeperAPI.put(`/api/timekeeper/start-list/${tempId}/time`, { time1: 33.2 });
    await TimekeeperAPI.put(`/api/timekeeper/start-list/${tempId}/excluded`, { excluded: true });

    // Offline startovka (i po obnovení stránky) ho ukazuje i s časem.
    const offlineList = await TimekeeperAPI.get(LIST);
    const local = offlineList.find((row) => row.id === tempId);
    expect(local).toMatchObject({ racer_surname: 'Offline', time1: 33.2, excluded: true });

    // Připojení se vrátí, fronta se přehraje.
    setOnline(true);
    const remapped = vi.fn();
    window.addEventListener(ENTRY_REMAPPED_EVENT, remapped);
    const sent = [];
    const executor = vi.fn(async (item) => {
      sent.push(`${item.method} ${item.endpoint}`);
      if (item.endpoint === CREATE) {
        return { id: 77, entry: startListEntry({ id: 77, race_id: RACE, start_number: 2, racer_surname: 'Offline', updated_at: 'r1' }) };
      }
      return { revision: 'r2' };
    });

    await processSyncQueue(executor);
    window.removeEventListener(ENTRY_REMAPPED_EVENT, remapped);

    expect(sent).toEqual([
      `POST ${CREATE}`,
      'PUT /api/timekeeper/start-list/77/time',
      'PUT /api/timekeeper/start-list/77/excluded',
    ]);
    expect(sent.some((line) => line.includes('/-'))).toBe(false);
    expect(remapped).toHaveBeenCalledTimes(1);
    expect(remapped.mock.calls[0][0].detail).toMatchObject({ tempId, serverId: 77 });

    expect(await timekeeperDb.startList.get(tempId)).toBeUndefined();
    expect(await timekeeperDb.startList.get(77)).toMatchObject({ time1: 33.2, excluded: true });
    const cached = await readCachedResponse(LIST, {});
    expect(cached.map((row) => row.id)).toEqual([1, 77]);
    expect(await getTempEntryMap()).toEqual({ [String(tempId)]: 77 });
    expect((await timekeeperDb.syncQueue.toArray()).every((row) => row.status === 'done')).toBe(true);
  });

  it('obrazovka, která ještě drží dočasné id, zapisuje už na serverové', async () => {
    const tempId = -42;
    await addOffline(tempId);
    setOnline(true);
    await processSyncQueue(async () => ({ id: 77, entry: startListEntry({ id: 77, race_id: RACE }) }));

    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ revision: 'r9' }) }));
    vi.stubGlobal('fetch', fetchMock);
    await TimekeeperAPI.put(`/api/timekeeper/start-list/${tempId}/time`, { time1: 40 });

    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/timekeeper/start-list/77/time');
  });

  it('obsazené číslo: přidání skončí v Sync centru a navazující časy čekají za ním', async () => {
    const tempId = -43;
    await addOffline(tempId);
    await TimekeeperAPI.put(`/api/timekeeper/start-list/${tempId}/time`, { time1: 33.2 });
    setOnline(true);
    const executor = vi.fn(async () => { throw apiError(400, 'Systémové číslo 12 už má jiný závodník'); });

    await processSyncQueue(executor);

    expect(executor).toHaveBeenCalledTimes(1);
    const [conflict] = await timekeeperDb.conflicts.toArray();
    expect(conflict.error_message).toBe('Systémové číslo 12 už má jiný závodník');
    const statuses = (await timekeeperDb.syncQueue.orderBy('id').toArray()).map((row) => row.status);
    expect(statuses).toEqual(['conflict', 'pending']);
    // Závodník z obrazovky nezmizel.
    expect(await timekeeperDb.startList.get(tempId)).toBeDefined();
  });

  it('Force u přidání pošle zápis bez čísla - server přidělí volné', async () => {
    const tempId = -44;
    await addOffline(tempId);
    setOnline(true);
    await processSyncQueue(vi.fn(async () => { throw apiError(400, 'Číslo obsazené'); }));
    const [conflict] = await timekeeperDb.conflicts.toArray();

    await resolveConflict(conflict.id, 'force');

    const [create] = await timekeeperDb.syncQueue.toArray();
    expect(create.status).toBe('pending');
    expect(create.payload.race_number_display).toBeUndefined();
    expect(create.payload.client_temp_id).toBe(tempId);
  });

  it('Drop u přidání odstraní dočasného závodníka i jeho navazující zápisy', async () => {
    const tempId = -45;
    await seedCachedStartList();
    await addOffline(tempId);
    await TimekeeperAPI.put(`/api/timekeeper/start-list/${tempId}/time`, { time1: 33.2 });
    setOnline(true);
    await processSyncQueue(vi.fn(async () => { throw apiError(400, 'Závodník je na startovní listině vyřazený'); }));
    const [conflict] = await timekeeperDb.conflicts.toArray();

    await resolveConflict(conflict.id, 'drop');

    const statuses = (await timekeeperDb.syncQueue.orderBy('id').toArray()).map((row) => row.status);
    expect(statuses).toEqual(['dropped', 'dropped']);
    expect(await timekeeperDb.startList.get(tempId)).toBeUndefined();
    expect((await readCachedResponse(LIST, {})).map((row) => row.id)).toEqual([1]);
  });

  it('čerstvá odpověď serveru dočasného závodníka neschová', async () => {
    const tempId = -46;
    await addOffline(tempId);
    setOnline(true);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => [serverRow] })));

    const list = await TimekeeperAPI.get(LIST);

    expect(list.map((row) => row.id)).toEqual([1, tempId]);
  });
});
