import { beforeEach, describe, expect, it } from 'vitest';
import { timekeeperDb } from './db.js';
import {
  affectedEntryIds,
  excludedEntryId,
  getQueuedEntryIds,
  getQueuedExcludedEntryIds,
  getQueuedMutationKeys,
  mutationKeys,
  stripSupersededRevisions,
} from './entryTargets.js';
import { resetTimekeeperDb } from '../test/helpers.js';

beforeEach(resetTimekeeperDb);

describe('affectedEntryIds', () => {
  it('rozpozná zápis času jednoho řádku', () => {
    expect(affectedEntryIds('PUT', '/api/timekeeper/start-list/42/time', { time1: 1 })).toEqual({
      ids: [42],
      batch: false,
    });
  });

  it('rozpozná zápis na řádek bez /time (přečíslování)', () => {
    expect(affectedEntryIds('PUT', '/api/timekeeper/start-list/42', { race_number: 7 })).toEqual({
      ids: [42],
      batch: false,
    });
  });

  it('rozpozná hromadný zápis časů a označí ho jako batch', () => {
    const payload = { entries: [{ entry_id: 1 }, { entry_id: 2 }] };
    expect(affectedEntryIds('POST', '/api/timekeeper/races/10/times', payload)).toEqual({
      ids: [1, 2],
      batch: true,
    });
  });

  it('zahodí položky bez použitelného entry_id', () => {
    const payload = { entries: [{ entry_id: 1 }, { entry_id: null }, { foo: 'bar' }] };
    expect(affectedEntryIds('POST', '/api/timekeeper/races/10/times', payload).ids).toEqual([1]);
  });

  it('nevrací nic pro endpointy, které se startovky netýkají', () => {
    expect(
      affectedEntryIds('POST', '/api/timekeeper/races/10/results/calculate-points', {}),
    ).toEqual({ ids: [], batch: false });
    // Správná cesta, ale jiná metoda - GET žádný řádek nemění.
    expect(affectedEntryIds('GET', '/api/timekeeper/start-list/42/time', null).ids).toEqual([]);
  });
});

describe('getQueuedEntryIds', () => {
  it('sbírá řádky ze všech nevyřízených stavů, hotové ignoruje', async () => {
    await timekeeperDb.syncQueue.bulkAdd([
      {
        status: 'pending',
        method: 'PUT',
        endpoint: '/api/timekeeper/start-list/1/time',
        payload: {},
        created_at: 'a',
      },
      {
        status: 'failed',
        method: 'PUT',
        endpoint: '/api/timekeeper/start-list/2/time',
        payload: {},
        created_at: 'b',
      },
      {
        status: 'processing',
        method: 'PUT',
        endpoint: '/api/timekeeper/start-list/3/time',
        payload: {},
        created_at: 'c',
      },
      {
        status: 'done',
        method: 'PUT',
        endpoint: '/api/timekeeper/start-list/4/time',
        payload: {},
        created_at: 'd',
      },
      {
        status: 'conflict',
        method: 'PUT',
        endpoint: '/api/timekeeper/start-list/5/time',
        payload: {},
        created_at: 'e',
      },
    ]);

    const ids = await getQueuedEntryIds();
    expect([...ids].sort()).toEqual([1, 2, 3]);
  });

  it('rozbalí i řádky z hromadného zápisu', async () => {
    await timekeeperDb.syncQueue.add({
      status: 'pending',
      method: 'POST',
      endpoint: '/api/timekeeper/races/10/times',
      payload: { entries: [{ entry_id: 7 }, { entry_id: 8 }] },
      created_at: 'a',
    });

    expect([...(await getQueuedEntryIds())].sort()).toEqual([7, 8]);
  });
});

describe('stripSupersededRevisions', () => {
  beforeEach(async () => {
    await timekeeperDb.syncQueue.add({
      status: 'pending',
      method: 'PUT',
      endpoint: '/api/timekeeper/start-list/1/time',
      payload: {},
      created_at: 'a',
    });
  });

  it('sebere base_revision zápisu na řádek, který už ve frontě čeká', async () => {
    const result = await stripSupersededRevisions('/api/timekeeper/start-list/1/time', {
      time1: 12.5,
      base_revision: 'stará',
    });
    expect(result).toEqual({ time1: 12.5 });
  });

  it('nechá base_revision řádku, který ve frontě není', async () => {
    const payload = { time1: 12.5, base_revision: 'platná' };
    expect(await stripSupersededRevisions('/api/timekeeper/start-list/99/time', payload)).toEqual(
      payload,
    );
  });

  it('v hromadném zápisu ošetří jen dotčené řádky', async () => {
    const result = await stripSupersededRevisions('/api/timekeeper/races/10/times', {
      entries: [
        { entry_id: 1, time1: 1, base_revision: 'stará' },
        { entry_id: 2, time1: 2, base_revision: 'platná' },
      ],
    });

    expect(result.entries[0]).toEqual({ entry_id: 1, time1: 1 });
    expect(result.entries[1]).toEqual({ entry_id: 2, time1: 2, base_revision: 'platná' });
  });

  it('prázdnou frontou payload neprochází zbytečně', async () => {
    await resetTimekeeperDb();
    const payload = { time1: 1, base_revision: 'platná' };
    expect(await stripSupersededRevisions('/api/timekeeper/start-list/1/time', payload)).toBe(
      payload,
    );
  });
});

describe('vyřazení ze startky jako samostatná řada zápisů', () => {
  const EXCLUDE = '/api/timekeeper/start-list/42/excluded';

  it('excludedEntryId pozná zápis vyřazení, nic jiného', () => {
    expect(excludedEntryId('PUT', EXCLUDE)).toBe(42);
    expect(excludedEntryId('put', EXCLUDE)).toBe(42);
    expect(excludedEntryId('GET', EXCLUDE)).toBeNull();
    expect(excludedEntryId('PUT', '/api/timekeeper/start-list/42/time')).toBeNull();
    expect(excludedEntryId('PUT', '/api/timekeeper/start-list/42')).toBeNull();
  });

  it('affectedEntryIds vyřazení nevrací - s časy se nemíchá', () => {
    // Jinak by úspěšné vyřazení "překonalo" zaparkovaný čas téhož závodníka
    // a po přehrání by se do snímku zapsala revize, ke které zařízení nemá časy.
    expect(affectedEntryIds('PUT', EXCLUDE, { excluded: true })).toEqual({ ids: [], batch: false });
  });

  it('mutationKeys oddělí časy od vyřazení', () => {
    expect(mutationKeys('PUT', EXCLUDE, { excluded: true })).toEqual(['excluded:42']);
    expect(mutationKeys('PUT', '/api/timekeeper/start-list/42/time', {})).toEqual(['entry:42']);
    expect(
      mutationKeys('post', '/api/timekeeper/races/10/times', {
        entries: [{ entry_id: 1 }, { entry_id: 2 }],
      }),
    ).toEqual(['entry:1', 'entry:2']);
    expect(mutationKeys('POST', '/api/timekeeper/races/10/results/calculate-points', {})).toEqual(
      [],
    );
  });

  it('nevyřízené zápisy se sbírají po klíčích i po vyřazených řádcích', async () => {
    await timekeeperDb.syncQueue.bulkAdd([
      {
        status: 'pending',
        method: 'PUT',
        endpoint: EXCLUDE,
        payload: { excluded: true },
        created_at: 'a',
      },
      {
        status: 'failed',
        method: 'PUT',
        endpoint: '/api/timekeeper/start-list/7/time',
        payload: {},
        created_at: 'b',
      },
      {
        status: 'done',
        method: 'PUT',
        endpoint: '/api/timekeeper/start-list/8/excluded',
        payload: {},
        created_at: 'c',
      },
    ]);

    expect([...(await getQueuedMutationKeys())].sort()).toEqual(['entry:7', 'excluded:42']);
    expect([...(await getQueuedExcludedEntryIds())]).toEqual([42]);
    // Čekající vyřazení nesebere base_revision zápisu času téhož řádku.
    expect([...(await getQueuedEntryIds())]).toEqual([7]);
  });
});
