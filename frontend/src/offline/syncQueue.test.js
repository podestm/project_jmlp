import { beforeEach, describe, expect, it } from 'vitest';
import { timekeeperDb } from './db.js';
import {
  enqueueMutation,
  getOpenConflicts,
  getQueueCandidates,
  getRecentQueueItems,
  getSyncQueueStats,
  hasUnsyncedMutationFor,
  resolveConflict,
  saveConflict,
  supersedeParkedOpsFor
} from './syncQueue.js';
import { resetTimekeeperDb } from '../test/helpers.js';

beforeEach(resetTimekeeperDb);

const queueRow = (overrides = {}) => ({
  op_id: 'op',
  status: 'pending',
  retry_count: 0,
  last_error: null,
  created_at: '2026-01-01T10:00:00.000Z',
  updated_at: '2026-01-01T10:00:00.000Z',
  next_retry_at: null,
  method: 'PUT',
  endpoint: '/api/timekeeper/start-list/1/time',
  payload: { time1: 10 },
  ...overrides
});

describe('enqueueMutation', () => {
  it('založí položku ve stavu pending a vrátí její id', async () => {
    const item = await enqueueMutation('PUT', '/api/timekeeper/start-list/1/time', { time1: 10 });

    expect(item.id).toBeGreaterThan(0);
    expect(item.status).toBe('pending');
    expect(item.op_id).toBeTruthy();
    expect(await timekeeperDb.syncQueue.count()).toBe(1);
  });

  it('respektuje předané op_id, aby přehrávka nesla stejný klíč idempotence', async () => {
    const item = await enqueueMutation('PUT', '/api/timekeeper/start-list/1/time', {}, 'pevne-op-id');
    expect(item.op_id).toBe('pevne-op-id');
  });

  it('druhému zápisu do téhož řádku sebere base_revision', async () => {
    await enqueueMutation('PUT', '/api/timekeeper/start-list/1/time', { time1: 10, base_revision: 'r1' });
    const second = await enqueueMutation('PUT', '/api/timekeeper/start-list/1/time', { time1: 11, base_revision: 'r1' });

    expect(second.payload).toEqual({ time1: 11 });
  });
});

describe('hasUnsyncedMutationFor', () => {
  it('pozná, že řádek už má zápis ve frontě', async () => {
    await enqueueMutation('PUT', '/api/timekeeper/start-list/1/time', { time1: 10 });

    expect(await hasUnsyncedMutationFor('PUT', '/api/timekeeper/start-list/1/time', {})).toBe(true);
    expect(await hasUnsyncedMutationFor('PUT', '/api/timekeeper/start-list/2/time', {})).toBe(false);
  });

  it('zachytí i překryv přes hromadný zápis', async () => {
    await enqueueMutation('POST', '/api/timekeeper/races/10/times', {
      entries: [{ entry_id: 5 }, { entry_id: 6 }]
    });

    expect(await hasUnsyncedMutationFor('PUT', '/api/timekeeper/start-list/6/time', {})).toBe(true);
  });

  it('pro endpoint bez řádků startovky vrací false', async () => {
    await enqueueMutation('PUT', '/api/timekeeper/start-list/1/time', {});
    expect(await hasUnsyncedMutationFor('POST', '/api/timekeeper/races/10/results/calculate-points', {}))
      .toBe(false);
  });
});

describe('supersedeParkedOpsFor', () => {
  it('označí zaparkovaný konflikt téhož řádku za překonaný a uzavře jeho konflikt', async () => {
    const id = await timekeeperDb.syncQueue.add(queueRow({ status: 'conflict' }));
    await saveConflict({ id, op_id: 'op', endpoint: '/api/timekeeper/start-list/1/time', method: 'PUT', payload: {} }, new Error('409'), 409);

    const count = await supersedeParkedOpsFor('PUT', '/api/timekeeper/start-list/1/time', {});

    expect(count).toBe(1);
    expect((await timekeeperDb.syncQueue.get(id)).status).toBe('superseded');
    expect(await getOpenConflicts()).toHaveLength(0);
  });

  it('nesahá na zápisy jiných řádků', async () => {
    const id = await timekeeperDb.syncQueue.add(queueRow({
      status: 'dead',
      endpoint: '/api/timekeeper/start-list/2/time'
    }));

    expect(await supersedeParkedOpsFor('PUT', '/api/timekeeper/start-list/1/time', {})).toBe(0);
    expect((await timekeeperDb.syncQueue.get(id)).status).toBe('dead');
  });

  it('s hranicí času nechá být položky, které vznikly až po odeslaném zápisu', async () => {
    await timekeeperDb.syncQueue.add(queueRow({ status: 'conflict', created_at: '2026-01-01T09:00:00.000Z' }));
    const newer = await timekeeperDb.syncQueue.add(queueRow({ status: 'conflict', created_at: '2026-01-01T11:00:00.000Z' }));

    const count = await supersedeParkedOpsFor(
      'PUT', '/api/timekeeper/start-list/1/time', {}, '2026-01-01T10:00:00.000Z'
    );

    expect(count).toBe(1);
    expect((await timekeeperDb.syncQueue.get(newer)).status).toBe('conflict');
  });

  it('čekající zápisy neruší - ty se mají přehrát', async () => {
    await timekeeperDb.syncQueue.add(queueRow({ status: 'pending' }));
    expect(await supersedeParkedOpsFor('PUT', '/api/timekeeper/start-list/1/time', {})).toBe(0);
  });
});

describe('getQueueCandidates', () => {
  it('vrací pending i failed v pořadí vzniku', async () => {
    await timekeeperDb.syncQueue.add(queueRow({ created_at: '2026-01-01T12:00:00.000Z', payload: { n: 2 } }));
    await timekeeperDb.syncQueue.add(queueRow({ created_at: '2026-01-01T11:00:00.000Z', payload: { n: 1 } }));
    await timekeeperDb.syncQueue.add(queueRow({ status: 'done', created_at: '2026-01-01T10:00:00.000Z' }));

    const candidates = await getQueueCandidates();
    expect(candidates.map((c) => c.row.payload.n)).toEqual([1, 2]);
  });

  it('označí položku s nedoběhlým odkladem jako nepřipravenou, ale nevyhodí ji', async () => {
    const future = new Date(Date.now() + 60000).toISOString();
    await timekeeperDb.syncQueue.add(queueRow({ status: 'failed', next_retry_at: future }));

    const [candidate] = await getQueueCandidates();
    expect(candidate.ready).toBe(false);
  });

  it('poškozené razítko odkladu bere jako "zkusit hned"', async () => {
    await timekeeperDb.syncQueue.add(queueRow({ status: 'failed', next_retry_at: 'nesmysl' }));

    const [candidate] = await getQueueCandidates();
    expect(candidate.ready).toBe(true);
  });
});

describe('statistiky a výpisy fronty', () => {
  it('spočítá položky po stavech', async () => {
    await timekeeperDb.syncQueue.bulkAdd([
      queueRow({ status: 'pending' }),
      queueRow({ status: 'failed' }),
      queueRow({ status: 'conflict' }),
      queueRow({ status: 'dead' }),
      queueRow({ status: 'done' })
    ]);

    const stats = await getSyncQueueStats();
    expect(stats).toMatchObject({ pending: 1, failed: 1, conflict: 1, dead: 1, total: 4 });
  });

  it('vrací poslední položky od nejnovější', async () => {
    await timekeeperDb.syncQueue.add(queueRow({ created_at: '2026-01-01T10:00:00.000Z', payload: { n: 1 } }));
    await timekeeperDb.syncQueue.add(queueRow({ created_at: '2026-01-01T12:00:00.000Z', payload: { n: 2 } }));

    const rows = await getRecentQueueItems(10);
    expect(rows[0].payload.n).toBe(2);
  });
});

describe('resolveConflict', () => {
  const seedConflict = async (payload = { time1: 10 }, detail = null) => {
    const queueItemId = await timekeeperDb.syncQueue.add(queueRow({ status: 'conflict', payload }));
    const conflictId = await timekeeperDb.conflicts.add({
      queue_item_id: queueItemId,
      op_id: 'op',
      endpoint: '/api/timekeeper/start-list/1/time',
      method: 'PUT',
      payload,
      status_code: 409,
      error_message: 'conflict',
      conflict_detail: detail,
      created_at: '2026-01-01T10:00:00.000Z',
      resolved: 0
    });
    return { queueItemId, conflictId };
  };

  it('"drop" zápis zahodí', async () => {
    const { queueItemId, conflictId } = await seedConflict();
    await resolveConflict(conflictId, 'drop');

    expect((await timekeeperDb.syncQueue.get(queueItemId)).status).toBe('dropped');
    expect((await timekeeperDb.conflicts.get(conflictId)).resolved).toBe(1);
  });

  it('"retry" vrátí zápis do fronty s vynulovanými pokusy', async () => {
    const { queueItemId, conflictId } = await seedConflict();
    await timekeeperDb.syncQueue.update(queueItemId, { retry_count: 5 });

    await resolveConflict(conflictId, 'retry');

    const row = await timekeeperDb.syncQueue.get(queueItemId);
    expect(row.status).toBe('pending');
    expect(row.retry_count).toBe(0);
  });

  it('"force" doplní force_apply', async () => {
    const { queueItemId, conflictId } = await seedConflict();
    await resolveConflict(conflictId, 'force');

    const row = await timekeeperDb.syncQueue.get(queueItemId);
    expect(row.payload.force_apply).toBe(true);
    expect(row.status).toBe('pending');
  });

  it('"force" u dávky označí jen řádek, kterého se konflikt týká', async () => {
    const payload = { entries: [{ entry_id: 1 }, { entry_id: 2 }] };
    const { queueItemId, conflictId } = await seedConflict(payload, { entry_id: 2 });

    await resolveConflict(conflictId, 'force');

    const row = await timekeeperDb.syncQueue.get(queueItemId);
    expect(row.payload.entries[0].force_apply).toBeUndefined();
    expect(row.payload.entries[1].force_apply).toBe(true);
  });

  it('neexistující konflikt nic neshodí', async () => {
    await expect(resolveConflict(9999, 'drop')).resolves.toBeUndefined();
  });
});

describe('vyřazení ze startky ve frontě', () => {
  const EXCLUDE = '/api/timekeeper/start-list/1/excluded';

  it('vyřazení čeká za starším vyřazením téhož závodníka', async () => {
    await enqueueMutation('PUT', EXCLUDE, { excluded: true });

    // "Vrátit" poslané rovnou by dorazilo první a starší "Vyřadit" by ho přepsalo.
    expect(await hasUnsyncedMutationFor('PUT', EXCLUDE, { excluded: false })).toBe(true);
    expect(await hasUnsyncedMutationFor('PUT', '/api/timekeeper/start-list/2/excluded', {})).toBe(false);
  });

  it('vyřazení a zápis času na sebe nečekají', async () => {
    await enqueueMutation('PUT', EXCLUDE, { excluded: true });
    expect(await hasUnsyncedMutationFor('PUT', '/api/timekeeper/start-list/1/time', {})).toBe(false);

    await resetTimekeeperDb();
    await enqueueMutation('PUT', '/api/timekeeper/start-list/1/time', { time1: 10 });
    expect(await hasUnsyncedMutationFor('PUT', EXCLUDE, { excluded: true })).toBe(false);
  });

  it('čekající vyřazení nesebere base_revision zápisu času', async () => {
    await enqueueMutation('PUT', EXCLUDE, { excluded: true });
    const time = await enqueueMutation('PUT', '/api/timekeeper/start-list/1/time', { time1: 10, base_revision: 'r1' });

    expect(time.payload).toEqual({ time1: 10, base_revision: 'r1' });
  });

  it('úspěšné vyřazení překoná jen zaparkované vyřazení, ne čas', async () => {
    const parkedTime = await timekeeperDb.syncQueue.add(queueRow({ status: 'conflict' }));
    const parkedExclusion = await timekeeperDb.syncQueue.add(queueRow({
      status: 'dead', endpoint: EXCLUDE, payload: { excluded: true }
    }));

    const count = await supersedeParkedOpsFor('PUT', EXCLUDE, { excluded: false });

    expect(count).toBe(1);
    expect((await timekeeperDb.syncQueue.get(parkedExclusion)).status).toBe('superseded');
    // Zaparkovaný naměřený čas musí dál čekat na rozhodnutí obsluhy.
    expect((await timekeeperDb.syncQueue.get(parkedTime)).status).toBe('conflict');
  });

  it('úspěšný zápis času nepřekoná zaparkované vyřazení', async () => {
    const parkedExclusion = await timekeeperDb.syncQueue.add(queueRow({
      status: 'dead', endpoint: EXCLUDE, payload: { excluded: true }
    }));

    expect(await supersedeParkedOpsFor('PUT', '/api/timekeeper/start-list/1/time', {})).toBe(0);
    expect((await timekeeperDb.syncQueue.get(parkedExclusion)).status).toBe('dead');
  });
});
