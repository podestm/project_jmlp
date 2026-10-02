import { beforeEach, describe, expect, it, vi } from 'vitest';
import { timekeeperDb } from './db.js';
import { processSyncQueue } from './sync.js';
import { apiError, resetTimekeeperDb, setOnline, startListEntry } from '../test/helpers.js';

const queueRow = (overrides = {}) => ({
  op_id: `op-${Math.random()}`,
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

beforeEach(async () => {
  await resetTimekeeperDb();
  setOnline(true);
});

describe('processSyncQueue - úspěšné přehrání', () => {
  it('odešle položku a označí ji za hotovou', async () => {
    const id = await timekeeperDb.syncQueue.add(queueRow());
    const executor = vi.fn().mockResolvedValue({ revision: 'r1' });

    await processSyncQueue(executor);

    expect(executor).toHaveBeenCalledTimes(1);
    expect((await timekeeperDb.syncQueue.get(id)).status).toBe('done');
  });

  it('zapíše revizi ze serveru do lokálního snímku', async () => {
    await timekeeperDb.startList.put(startListEntry({ updated_at: 'stará', updated_local_only: true }));
    await timekeeperDb.syncQueue.add(queueRow());

    await processSyncQueue(vi.fn().mockResolvedValue({ revision: 'nová' }));

    const entry = await timekeeperDb.startList.get(1);
    expect(entry.updated_at).toBe('nová');
    expect(entry.updated_local_only).toBe(false);
  });

  it('offline se vůbec nespustí', async () => {
    setOnline(false);
    await timekeeperDb.syncQueue.add(queueRow());
    const executor = vi.fn();

    await processSyncQueue(executor);

    expect(executor).not.toHaveBeenCalled();
  });
});

describe('processSyncQueue - pořadí zápisů do téhož řádku', () => {
  it('zachová pořadí vzniku', async () => {
    await timekeeperDb.syncQueue.add(queueRow({ created_at: '2026-01-01T10:00:00.000Z', payload: { time1: 1 } }));
    await timekeeperDb.syncQueue.add(queueRow({ created_at: '2026-01-01T11:00:00.000Z', payload: { time1: 2 } }));

    const seen = [];
    await processSyncQueue(async (item) => { seen.push(item.payload.time1); return {}; });

    expect(seen).toEqual([1, 2]);
  });

  /**
   * Jádro věci: starší zápis čeká na odklad, novější pro TENTÝŽ řádek proto
   * nesmí projít dopředu - jinak by ho pak starší přehrávka přepsala zpátky.
   */
  it('zastaví novější zápis za starším, který ještě čeká na odklad', async () => {
    const future = new Date(Date.now() + 60000).toISOString();
    await timekeeperDb.syncQueue.add(queueRow({
      status: 'failed', created_at: '2026-01-01T10:00:00.000Z', next_retry_at: future, payload: { time1: 1 }
    }));
    await timekeeperDb.syncQueue.add(queueRow({
      created_at: '2026-01-01T11:00:00.000Z', payload: { time1: 2 }
    }));

    const executor = vi.fn().mockResolvedValue({});
    await processSyncQueue(executor);

    expect(executor).not.toHaveBeenCalled();
  });

  it('zápis do JINÉHO řádku odkladem blokovaný není', async () => {
    const future = new Date(Date.now() + 60000).toISOString();
    await timekeeperDb.syncQueue.add(queueRow({
      status: 'failed', created_at: '2026-01-01T10:00:00.000Z', next_retry_at: future
    }));
    await timekeeperDb.syncQueue.add(queueRow({
      created_at: '2026-01-01T11:00:00.000Z', endpoint: '/api/timekeeper/start-list/2/time'
    }));

    const executor = vi.fn().mockResolvedValue({});
    await processSyncQueue(executor);

    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor.mock.calls[0][0].endpoint).toBe('/api/timekeeper/start-list/2/time');
  });

  it('po konfliktu zastaví další zápisy téhož řádku', async () => {
    await timekeeperDb.syncQueue.add(queueRow({ created_at: '2026-01-01T10:00:00.000Z' }));
    await timekeeperDb.syncQueue.add(queueRow({ created_at: '2026-01-01T11:00:00.000Z' }));

    const executor = vi.fn().mockRejectedValueOnce(apiError(409, { entry_id: 1 }));
    await processSyncQueue(executor);

    expect(executor).toHaveBeenCalledTimes(1);
  });
});

describe('processSyncQueue - chybové stavy', () => {
  it('409 uloží konflikt a zaparkuje položku', async () => {
    const id = await timekeeperDb.syncQueue.add(queueRow());

    await processSyncQueue(vi.fn().mockRejectedValue(apiError(409, { entry_id: 1 })));

    expect((await timekeeperDb.syncQueue.get(id)).status).toBe('conflict');
    expect(await timekeeperDb.conflicts.count()).toBe(1);
  });

  it('401 vrátí položku do fronty, odloží ji a smyčku ukončí', async () => {
    const first = await timekeeperDb.syncQueue.add(queueRow({ created_at: '2026-01-01T10:00:00.000Z' }));
    await timekeeperDb.syncQueue.add(queueRow({
      created_at: '2026-01-01T11:00:00.000Z', endpoint: '/api/timekeeper/start-list/2/time'
    }));

    const executor = vi.fn().mockRejectedValue(apiError(401));
    await processSyncQueue(executor);

    const row = await timekeeperDb.syncQueue.get(first);
    expect(row.status).toBe('pending');
    expect(row.retry_count).toBe(0);
    expect(row.last_error).toContain('Přihlášení vypršelo');
    // Druhá položka se nesmí pokusit o totéž a spálit pokusy o stejnou zeď.
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it('síťová chyba zvýší počet pokusů a nastaví odklad', async () => {
    const id = await timekeeperDb.syncQueue.add(queueRow());

    await processSyncQueue(vi.fn().mockRejectedValue(new Error('Failed to fetch')));

    const row = await timekeeperDb.syncQueue.get(id);
    expect(row.status).toBe('failed');
    expect(row.retry_count).toBe(1);
    expect(Date.parse(row.next_retry_at)).toBeGreaterThan(Date.now());
  });

  it('po vyčerpání pokusů položku zaparkuje jako mrtvou, ne zahodí', async () => {
    const id = await timekeeperDb.syncQueue.add(queueRow({ status: 'failed', retry_count: 8 }));

    const executor = vi.fn();
    await processSyncQueue(executor);

    expect(executor).not.toHaveBeenCalled();
    expect((await timekeeperDb.syncQueue.get(id)).status).toBe('dead');
  });
});

describe('processSyncQueue - osiřelé požadavky', () => {
  it('vrátí do fronty položku zaseklou v processing a rovnou ji odešle', async () => {
    const old = new Date(Date.now() - 300000).toISOString();
    const id = await timekeeperDb.syncQueue.add(queueRow({ status: 'processing', updated_at: old }));

    const executor = vi.fn().mockResolvedValue({});
    await processSyncQueue(executor);

    expect(executor).toHaveBeenCalledTimes(1);
    expect((await timekeeperDb.syncQueue.get(id)).status).toBe('done');
  });

  it('čerstvý processing nechá běžet - požadavek je nejspíš na cestě', async () => {
    const id = await timekeeperDb.syncQueue.add(queueRow({ status: 'processing', updated_at: new Date().toISOString() }));

    await processSyncQueue(vi.fn().mockResolvedValue({}));

    expect((await timekeeperDb.syncQueue.get(id)).status).toBe('processing');
  });
});

describe('processSyncQueue - překonané zápisy', () => {
  it('úspěšný zápis označí starší zaparkovaný konflikt téhož řádku za překonaný', async () => {
    const parked = await timekeeperDb.syncQueue.add(queueRow({
      status: 'conflict', created_at: '2026-01-01T09:00:00.000Z'
    }));
    await timekeeperDb.syncQueue.add(queueRow({ created_at: '2026-01-01T10:00:00.000Z' }));

    await processSyncQueue(vi.fn().mockResolvedValue({ revision: 'r' }));

    expect((await timekeeperDb.syncQueue.get(parked)).status).toBe('superseded');
  });
});

describe('processSyncQueue - vyřazení ze startky', () => {
  const EXCLUDE = '/api/timekeeper/start-list/1/excluded';

  it('vyřazení drží pořadí za starším vyřazením, které čeká na odklad', async () => {
    const future = new Date(Date.now() + 60000).toISOString();
    await timekeeperDb.syncQueue.add(queueRow({
      status: 'failed', created_at: '2026-01-01T10:00:00.000Z', next_retry_at: future,
      endpoint: EXCLUDE, payload: { excluded: true }
    }));
    await timekeeperDb.syncQueue.add(queueRow({
      created_at: '2026-01-01T11:00:00.000Z', endpoint: EXCLUDE, payload: { excluded: false }
    }));

    const executor = vi.fn().mockResolvedValue({});
    await processSyncQueue(executor);

    // "Vrátit" nesmí předběhnout "Vyřadit" - to by se pak přehrálo navrch.
    expect(executor).not.toHaveBeenCalled();
  });

  it('čas téhož závodníka za odloženým vyřazením nečeká', async () => {
    const future = new Date(Date.now() + 60000).toISOString();
    await timekeeperDb.syncQueue.add(queueRow({
      status: 'failed', created_at: '2026-01-01T10:00:00.000Z', next_retry_at: future,
      endpoint: EXCLUDE, payload: { excluded: true }
    }));
    await timekeeperDb.syncQueue.add(queueRow({ created_at: '2026-01-01T11:00:00.000Z' }));

    const executor = vi.fn().mockResolvedValue({ revision: 'r' });
    await processSyncQueue(executor);

    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor.mock.calls[0][0].endpoint).toBe('/api/timekeeper/start-list/1/time');
  });

  it('přehrané vyřazení nezapíše do snímku revizi z odpovědi', async () => {
    await timekeeperDb.startList.put(startListEntry({ updated_at: 'moje', excluded: true }));
    await timekeeperDb.syncQueue.add(queueRow({ endpoint: EXCLUDE, payload: { excluded: true } }));

    await processSyncQueue(vi.fn().mockResolvedValue({
      entry: { id: 1, excluded: true, updated_at: 'cizí' }
    }));

    // Revize v odpovědi může patřit časům z jiného zařízení, které tu nejsou.
    const entry = await timekeeperDb.startList.get(1);
    expect(entry.updated_at).toBe('moje');
    expect(entry.excluded).toBe(true);
  });
});
