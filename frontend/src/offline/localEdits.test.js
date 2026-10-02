import { beforeEach, describe, expect, it } from 'vitest';
import { timekeeperDb } from './db.js';
import {
  applyLocalMutation,
  applySyncedRevisions,
  computeTimeSum,
  revisionsFromResponse,
  START_LIST_REVISION_EVENT
} from './localEdits.js';
import { resetTimekeeperDb, startListEntry } from '../test/helpers.js';

const CACHE_KEY = '/api/timekeeper/races/10/start-list';

const seedEntry = async (overrides = {}) => {
  const entry = startListEntry(overrides);
  await timekeeperDb.startList.put(entry);
  await timekeeperDb.cache.put({
    key: CACHE_KEY,
    endpoint: CACHE_KEY,
    params: null,
    data: [entry],
    updated_at: '2026-01-01T10:00:00.000Z'
  });
  return entry;
};

const cachedEntry = async (id = 1) => {
  const row = await timekeeperDb.cache.get(CACHE_KEY);
  return row.data.find((item) => item.id === id);
};

beforeEach(resetTimekeeperDb);

describe('computeTimeSum', () => {
  it('sečte obě jízdy', () => {
    expect(computeTimeSum({ time1: 30.5, time2: 29.5 })).toBe(60);
  });

  it('s jedinou jízdou vrátí ji samotnou', () => {
    expect(computeTimeSum({ time1: 30.5, time2: null })).toBe(30.5);
    expect(computeTimeSum({ time1: null, time2: 29.5 })).toBe(29.5);
  });

  it('jakýkoli příznak součet ruší', () => {
    expect(computeTimeSum({ time1: 30, time2: 30, dnf: true })).toBeNull();
    expect(computeTimeSum({ time1: 30, time2: 30, dns: true })).toBeNull();
    expect(computeTimeSum({ time1: 30, time2: 30, dsq: true })).toBeNull();
  });

  it('bez času vrací null', () => {
    expect(computeTimeSum({ time1: null, time2: null })).toBeNull();
  });
});

describe('revisionsFromResponse', () => {
  it('přečte revizi z jednotlivé odpovědi', () => {
    expect(revisionsFromResponse({ revision: 'r1' }))
      .toEqual({ serverRevision: 'r1', serverRevisions: null });
  });

  it('vezme revizi z vnořeného entry, když samostatná není', () => {
    expect(revisionsFromResponse({ entry: { updated_at: 'r2' } }).serverRevision).toBe('r2');
  });

  it('přečte mapu revizí u hromadné odpovědi', () => {
    expect(revisionsFromResponse({ revisions: { 1: 'a', 2: 'b' } }).serverRevisions)
      .toEqual({ 1: 'a', 2: 'b' });
  });

  it('prázdnou odpověď snese', () => {
    expect(revisionsFromResponse(null)).toEqual({ serverRevision: null, serverRevisions: null });
  });
});

describe('applyLocalMutation - offline zápis času', () => {
  it('zapíše čas do snímku i do nakešované odpovědi', async () => {
    await seedEntry();

    await applyLocalMutation('PUT', '/api/timekeeper/start-list/1/time', { time1: 25.5 });

    const snapshot = await timekeeperDb.startList.get(1);
    expect(snapshot.time1).toBe(25.5);
    expect(snapshot.time_sum).toBe(25.5);
    expect(snapshot.updated_local_only).toBe(true);

    // Bez zápisu do cache by obnovení stránky offline ten čas ztratilo.
    expect((await cachedEntry()).time1).toBe(25.5);
  });

  it('NEPŘEPÍŠE serverovou revizi lokálním razítkem', async () => {
    await seedEntry({ updated_at: 'revize-ze-serveru' });

    await applyLocalMutation('PUT', '/api/timekeeper/start-list/1/time', { time1: 25.5 });

    const snapshot = await timekeeperDb.startList.get(1);
    // Kdyby se sem dostal lokální čas, další zápis by dostal od serveru 409.
    expect(snapshot.updated_at).toBe('revize-ze-serveru');
    expect(snapshot.updated_local_at).not.toBe('revize-ze-serveru');
  });

  it('online zápis převezme čerstvou revizi ze serveru', async () => {
    await seedEntry({ updated_at: 'stará' });

    await applyLocalMutation('PUT', '/api/timekeeper/start-list/1/time', { time1: 25.5 }, {
      syncedRemote: true,
      serverRevision: 'nová'
    });

    const snapshot = await timekeeperDb.startList.get(1);
    expect(snapshot.updated_at).toBe('nová');
    expect(snapshot.updated_local_only).toBe(false);
  });
});

describe('applyLocalMutation - hromadný zápis', () => {
  it('zapíše všechny řádky dávky', async () => {
    await timekeeperDb.startList.bulkPut([
      startListEntry({ id: 1 }),
      startListEntry({ id: 2, start_number: 2 })
    ]);
    await timekeeperDb.cache.put({
      key: CACHE_KEY,
      endpoint: CACHE_KEY,
      params: null,
      data: [startListEntry({ id: 1 }), startListEntry({ id: 2, start_number: 2 })],
      updated_at: 'x'
    });

    await applyLocalMutation('POST', '/api/timekeeper/races/10/times', {
      entries: [
        { entry_id: 1, time1: 10, time2: 11 },
        { entry_id: 2, time1: 12, time2: null, dnf: true }
      ]
    });

    expect((await timekeeperDb.startList.get(1)).time_sum).toBe(21);
    expect((await timekeeperDb.startList.get(2)).time_sum).toBeNull();
    expect((await cachedEntry(2)).dnf).toBe(true);
  });

  it('u dávky bez mapy revizí nechá revizi prázdnou místo cizí hodnoty', async () => {
    await seedEntry({ updated_at: 'stará' });

    await applyLocalMutation('POST', '/api/timekeeper/races/10/times', {
      entries: [{ entry_id: 1, time1: 10 }]
    }, { syncedRemote: true, serverRevision: 'revize-jineho-radku' });

    // Přiřadit celé dávce jednu revizi znamená jistý 409 při dalším zápisu.
    expect((await timekeeperDb.startList.get(1)).updated_at).toBeNull();
  });

  it('s mapou revizí přiřadí každému řádku tu jeho', async () => {
    await timekeeperDb.startList.bulkPut([startListEntry({ id: 1 }), startListEntry({ id: 2 })]);

    await applyLocalMutation('POST', '/api/timekeeper/races/10/times', {
      entries: [{ entry_id: 1, time1: 10 }, { entry_id: 2, time1: 20 }]
    }, { syncedRemote: true, serverRevisions: { 1: 'r1', 2: 'r2' } });

    expect((await timekeeperDb.startList.get(1)).updated_at).toBe('r1');
    expect((await timekeeperDb.startList.get(2)).updated_at).toBe('r2');
  });
});

describe('applyLocalMutation - přečíslování dresu', () => {
  it('offline nedělá nic, protože tělo požadavku není celý řádek', async () => {
    await seedEntry({ race_number_actual: 5 });

    await applyLocalMutation('PUT', '/api/timekeeper/start-list/1', { race_number_id: 99 });

    expect((await timekeeperDb.startList.get(1)).race_number_actual).toBe(5);
  });

  it('online promítne serverovou podobu řádku', async () => {
    await seedEntry({ race_number_actual: 5 });

    await applyLocalMutation('PUT', '/api/timekeeper/start-list/1', { race_number_id: 99 }, {
      syncedRemote: true,
      serverEntry: { race_number_actual: 42 },
      serverRevision: 'r9'
    });

    const snapshot = await timekeeperDb.startList.get(1);
    expect(snapshot.race_number_actual).toBe(42);
    expect(snapshot.updated_at).toBe('r9');
  });
});

describe('applyLocalMutation - vyřazení ze startky', () => {
  const EXCLUDE = '/api/timekeeper/start-list/1/excluded';

  it('offline promítne vyřazení do snímku i do nakešované startovky', async () => {
    await seedEntry({ time1: 30, updated_at: 'revize-ze-serveru' });

    await applyLocalMutation('PUT', EXCLUDE, { excluded: true });

    const snapshot = await timekeeperDb.startList.get(1);
    expect(snapshot.excluded).toBe(true);
    // Časy ani revize se nemění - vyřazení se dá vrátit i s nimi.
    expect(snapshot.time1).toBe(30);
    expect(snapshot.updated_at).toBe('revize-ze-serveru');
    // Obrazovka Časy čte offline z cache; bez zápisu by ho dál ukazovala.
    expect((await cachedEntry()).excluded).toBe(true);
    expect((await cachedEntry()).time1).toBe(30);
  });

  it('vrácení příznak zase shodí', async () => {
    await seedEntry({ excluded: true });

    await applyLocalMutation('PUT', EXCLUDE, { excluded: false });

    expect((await timekeeperDb.startList.get(1)).excluded).toBe(false);
    expect((await cachedEntry()).excluded).toBe(false);
  });

  it('online vezme stav ze serveru, ale ne jeho revizi ani časy', async () => {
    await seedEntry({ time1: 30, updated_at: 'moje' });

    await applyLocalMutation('PUT', EXCLUDE, { excluded: true }, {
      syncedRemote: true,
      serverEntry: { id: 1, excluded: true, time1: 99, updated_at: 'cizí' },
      serverRevision: 'cizí'
    });

    const snapshot = await timekeeperDb.startList.get(1);
    expect(snapshot.excluded).toBe(true);
    expect(snapshot.time1).toBe(30);
    expect(snapshot.updated_at).toBe('moje');
  });
});

describe('applySyncedRevisions', () => {
  it('po synchronizaci zapíše revizi a zruší příznak lokální změny', async () => {
    await seedEntry({ updated_local_only: true, updated_at: 'stará' });

    await applySyncedRevisions(
      { method: 'PUT', endpoint: '/api/timekeeper/start-list/1/time', payload: {} },
      { revision: 'nová' }
    );

    const snapshot = await timekeeperDb.startList.get(1);
    expect(snapshot.updated_at).toBe('nová');
    expect(snapshot.updated_local_only).toBe(false);
    expect((await cachedEntry()).updated_local_only).toBe(false);
  });

  it('ohlásí nové revize událostí, aby je obrazovka převzala', async () => {
    await seedEntry();
    const seen = [];
    const listener = (event) => seen.push(event.detail.revisions);
    window.addEventListener(START_LIST_REVISION_EVENT, listener);

    try {
      await applySyncedRevisions(
        { method: 'PUT', endpoint: '/api/timekeeper/start-list/1/time', payload: {} },
        { revision: 'nová' }
      );
    } finally {
      window.removeEventListener(START_LIST_REVISION_EVENT, listener);
    }

    // Bez téhle události drží obrazovka revizi z doby před výpadkem a další
    // zápis do řádku dostane 409, přestože na něj nikdo jiný nesahal.
    expect(seen).toEqual([{ 1: 'nová' }]);
  });

  it('u hromadné odpovědi rozešle revizi ke každému řádku zvlášť', async () => {
    await timekeeperDb.startList.bulkPut([startListEntry({ id: 1 }), startListEntry({ id: 2 })]);
    const seen = [];
    const listener = (event) => seen.push(event.detail.revisions);
    window.addEventListener(START_LIST_REVISION_EVENT, listener);

    try {
      await applySyncedRevisions(
        {
          method: 'POST',
          endpoint: '/api/timekeeper/races/10/times',
          payload: { entries: [{ entry_id: 1 }, { entry_id: 2 }] }
        },
        { revisions: { 1: 'r1', 2: 'r2' } }
      );
    } finally {
      window.removeEventListener(START_LIST_REVISION_EVENT, listener);
    }

    expect(seen).toEqual([{ 1: 'r1', 2: 'r2' }]);
  });

  it('chybu při zápisu do cache spolkne - synchronizace proběhla', async () => {
    await expect(applySyncedRevisions(
      { method: 'PUT', endpoint: '/api/timekeeper/start-list/999/time', payload: {} },
      { revision: 'nová' }
    )).resolves.toBeUndefined();
  });
});
