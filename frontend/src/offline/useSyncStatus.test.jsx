import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { timekeeperDb } from './db.js';
import { useSyncStatus } from './useSyncStatus.js';
import { TimekeeperAPI } from '../config/timekeeperApi.js';
import { resetTimekeeperDb } from '../test/helpers.js';

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
  ...overrides,
});

beforeEach(async () => {
  await resetTimekeeperDb();
  localStorage.setItem('auth_token', 'token-pro-test');
});

/**
 * Hlášení z terénu: na slabém signálu ukazovala časomíra „chyba
 * synchronizace“, přestože jen nebylo spojení. Prohlížeč přitom hlásí síť.
 */
describe('useSyncStatus - výpadek spojení', () => {
  it('nedoručená přehrávka ukáže offline, ne chybu', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await timekeeperDb.syncQueue.add(queueRow());
    const { result } = renderHook(() => useSyncStatus());

    await act(async () => {
      await TimekeeperAPI.flushQueue();
    });

    await waitFor(() => expect(result.current.syncState).toBe('offline'));
    expect(result.current.isOnline).toBe(false);
    expect(result.current.queueStats).toMatchObject({ pending: 1, failed: 0, dead: 0 });
  });

  it('skutečná chyba serveru zůstává chybou synchronizace', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Test',
        json: async () => ({}),
      }),
    );
    await timekeeperDb.syncQueue.add(queueRow());
    const { result } = renderHook(() => useSyncStatus());

    await act(async () => {
      await TimekeeperAPI.flushQueue();
    });

    await waitFor(() => expect(result.current.syncState).toBe('error'));
    expect(result.current.isOnline).toBe(true);
  });
});
