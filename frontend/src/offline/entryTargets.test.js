import { beforeEach, describe, expect, it } from 'vitest';
import { timekeeperDb } from './db.js';
import { affectedEntryIds, getQueuedEntryIds, stripSupersededRevisions } from './entryTargets.js';
import { resetTimekeeperDb } from '../test/helpers.js';

beforeEach(resetTimekeeperDb);

describe('affectedEntryIds', () => {
  it('rozpozná zápis času jednoho řádku', () => {
    expect(affectedEntryIds('PUT', '/api/timekeeper/start-list/42/time', { time1: 1 }))
      .toEqual({ ids: [42], batch: false });
  });

  it('rozpozná zápis na řádek bez /time (přečíslování)', () => {
    expect(affectedEntryIds('PUT', '/api/timekeeper/start-list/42', { race_number: 7 }))
      .toEqual({ ids: [42], batch: false });
  });

  it('rozpozná hromadný zápis časů a označí ho jako batch', () => {
    const payload = { entries: [{ entry_id: 1 }, { entry_id: 2 }] };
    expect(affectedEntryIds('POST', '/api/timekeeper/races/10/times', payload))
      .toEqual({ ids: [1, 2], batch: true });
  });

  it('zahodí položky bez použitelného entry_id', () => {
    const payload = { entries: [{ entry_id: 1 }, { entry_id: null }, { foo: 'bar' }] };
    expect(affectedEntryIds('POST', '/api/timekeeper/races/10/times', payload).ids).toEqual([1]);
  });

  it('nevrací nic pro endpointy, které se startovky netýkají', () => {
    expect(affectedEntryIds('POST', '/api/timekeeper/races/10/results/calculate-points', {}))
      .toEqual({ ids: [], batch: false });
    // Správná cesta, ale jiná metoda - GET žádný řádek nemění.
    expect(affectedEntryIds('GET', '/api/timekeeper/start-list/42/time', null).ids).toEqual([]);
  });
});

describe('getQueuedEntryIds', () => {
  it('sbírá řádky ze všech nevyřízených stavů, hotové ignoruje', async () => {
    await timekeeperDb.syncQueue.bulkAdd([
      { status: 'pending', method: 'PUT', endpoint: '/api/timekeeper/start-list/1/time', payload: {}, created_at: 'a' },
      { status: 'failed', method: 'PUT', endpoint: '/api/timekeeper/start-list/2/time', payload: {}, created_at: 'b' },
      { status: 'processing', method: 'PUT', endpoint: '/api/timekeeper/start-list/3/time', payload: {}, created_at: 'c' },
      { status: 'done', method: 'PUT', endpoint: '/api/timekeeper/start-list/4/time', payload: {}, created_at: 'd' },
      { status: 'conflict', method: 'PUT', endpoint: '/api/timekeeper/start-list/5/time', payload: {}, created_at: 'e' }
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
      created_at: 'a'
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
      created_at: 'a'
    });
  });

  it('sebere base_revision zápisu na řádek, který už ve frontě čeká', async () => {
    const result = await stripSupersededRevisions(
      '/api/timekeeper/start-list/1/time',
      { time1: 12.5, base_revision: 'stará' }
    );
    expect(result).toEqual({ time1: 12.5 });
  });

  it('nechá base_revision řádku, který ve frontě není', async () => {
    const payload = { time1: 12.5, base_revision: 'platná' };
    expect(await stripSupersededRevisions('/api/timekeeper/start-list/99/time', payload))
      .toEqual(payload);
  });

  it('v hromadném zápisu ošetří jen dotčené řádky', async () => {
    const result = await stripSupersededRevisions('/api/timekeeper/races/10/times', {
      entries: [
        { entry_id: 1, time1: 1, base_revision: 'stará' },
        { entry_id: 2, time1: 2, base_revision: 'platná' }
      ]
    });

    expect(result.entries[0]).toEqual({ entry_id: 1, time1: 1 });
    expect(result.entries[1]).toEqual({ entry_id: 2, time1: 2, base_revision: 'platná' });
  });

  it('prázdnou frontou payload neprochází zbytečně', async () => {
    await resetTimekeeperDb();
    const payload = { time1: 1, base_revision: 'platná' };
    expect(await stripSupersededRevisions('/api/timekeeper/start-list/1/time', payload)).toBe(payload);
  });
});
