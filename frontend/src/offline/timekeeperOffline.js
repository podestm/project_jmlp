import { timekeeperDb } from './db.js';

const SYNC_INTERVAL_MS = 10000;
const MAX_RETRIES = 8;

let syncLoopStarted = false;
let syncInProgress = false;

const nowIso = () => new Date().toISOString();

const toStableJson = (value) => {
  if (value == null) return '';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  return JSON.stringify(Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = value[key];
    return acc;
  }, {}));
};

export const buildCacheKey = (endpoint, params = null) => {
  const suffix = params ? `?${toStableJson(params)}` : '';
  return `${endpoint}${suffix}`;
};

export const readCachedResponse = async (endpoint, params = null) => {
  const key = buildCacheKey(endpoint, params);
  const row = await timekeeperDb.cache.get(key);
  return row ? row.data : null;
};

const persistRaceSnapshot = async (data) => {
  if (!Array.isArray(data)) return;
  const timestamp = nowIso();
  await timekeeperDb.races.bulkPut(data.map((race) => ({
    ...race,
    updated_at: timestamp
  })));
};

const parseRaceIdFromStartListEndpoint = (endpoint) => {
  const match = endpoint.match(/^\/api\/timekeeper\/races\/(\d+)\/start-list/);
  return match ? Number(match[1]) : null;
};

const persistStartListSnapshot = async (raceId, data) => {
  if (!Array.isArray(data)) return;
  const timestamp = nowIso();
  await timekeeperDb.startList.bulkPut(data.map((entry) => ({
    ...entry,
    race_id: entry.race_id ?? raceId,
    updated_at: timestamp
  })));
};

export const cacheGetResponse = async (endpoint, params = null, data = null) => {
  const timestamp = nowIso();
  const key = buildCacheKey(endpoint, params);
  await timekeeperDb.cache.put({
    key,
    endpoint,
    params,
    data,
    updated_at: timestamp
  });

  if (endpoint === '/api/timekeeper/races') {
    await persistRaceSnapshot(data);
    return;
  }

  const raceId = parseRaceIdFromStartListEndpoint(endpoint);
  if (raceId != null) {
    await persistStartListSnapshot(raceId, data);
  }
};

const calculateBackoffMs = (retryCount) => {
  const capped = Math.min(retryCount, 6);
  return (2 ** capped) * 1000;
};

const extractStatusCode = (error) => {
  if (typeof error?.status === 'number') return error.status;
  if (!error?.message) return null;
  const match = error.message.match(/API Error: (\d+)/);
  return match ? Number(match[1]) : null;
};

const saveConflict = async (queueItem, error, statusCode) => {
  await timekeeperDb.conflicts.add({
    queue_item_id: queueItem.id,
    op_id: queueItem.op_id,
    endpoint: queueItem.endpoint,
    method: queueItem.method,
    payload: queueItem.payload,
    status_code: statusCode,
    error_message: error?.message || 'Conflict detected',
    conflict_detail: error?.detail || null,
    created_at: nowIso(),
    resolved: 0
  });
};

const createQueueItem = (method, endpoint, payload = null) => ({
  op_id: typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  status: 'pending',
  retry_count: 0,
  last_error: null,
  created_at: nowIso(),
  updated_at: nowIso(),
  next_retry_at: null,
  method,
  endpoint,
  payload
});

export const enqueueMutation = async (method, endpoint, payload = null) => {
  const item = createQueueItem(method, endpoint, payload);
  const id = await timekeeperDb.syncQueue.add(item);
  return { ...item, id };
};

const updateStartListEntry = async (entryId, updater) => {
  const existing = await timekeeperDb.startList.get(entryId);
  if (!existing) return;
  await timekeeperDb.startList.put(updater(existing));
};

export const applyLocalMutation = async (method, endpoint, payload = null) => {
  if (method === 'PUT') {
    const timeMatch = endpoint.match(/^\/api\/timekeeper\/start-list\/(\d+)\/time$/);
    if (timeMatch) {
      const entryId = Number(timeMatch[1]);
      await updateStartListEntry(entryId, (entry) => ({
        ...entry,
        ...payload,
        updated_at: nowIso(),
        updated_local_only: true
      }));
      return;
    }

    const entryMatch = endpoint.match(/^\/api\/timekeeper\/start-list\/(\d+)$/);
    if (entryMatch) {
      const entryId = Number(entryMatch[1]);
      await updateStartListEntry(entryId, (entry) => ({
        ...entry,
        ...payload,
        updated_at: nowIso(),
        updated_local_only: true
      }));
      return;
    }
  }

  if (method === 'POST') {
    const batchMatch = endpoint.match(/^\/api\/timekeeper\/races\/(\d+)\/times$/);
    if (batchMatch && payload && Array.isArray(payload.entries)) {
      const timestamp = nowIso();
      await Promise.all(payload.entries.map(async (item) => {
        if (!item || !item.entry_id) return;
        await updateStartListEntry(Number(item.entry_id), (entry) => ({
          ...entry,
          time1: item.time1,
          time2: item.time2,
          dnf: Boolean(item.dnf),
          dns: Boolean(item.dns),
          dsq: Boolean(item.dsq),
          updated_at: timestamp,
          updated_local_only: true
        }));
      }));
    }
  }
};

const getQueueCandidates = async () => {
  const rows = await timekeeperDb.syncQueue
    .where('status')
    .anyOf('pending', 'failed')
    .sortBy('created_at');

  const currentTs = Date.now();
  return rows.filter((row) => {
    if (!row.next_retry_at) return true;
    return Date.parse(row.next_retry_at) <= currentTs;
  });
};

export const processSyncQueue = async (executor) => {
  if (syncInProgress) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  syncInProgress = true;
  try {
    const candidates = await getQueueCandidates();
    for (const item of candidates) {
      if (item.retry_count >= MAX_RETRIES) continue;

      await timekeeperDb.syncQueue.update(item.id, {
        status: 'processing',
        updated_at: nowIso()
      });

      try {
        await executor(item);
        await timekeeperDb.syncQueue.update(item.id, {
          status: 'done',
          updated_at: nowIso(),
          last_error: null,
          next_retry_at: null
        });
      } catch (error) {
        const statusCode = extractStatusCode(error);
        if (statusCode === 409) {
          await saveConflict(item, error, statusCode);
          await timekeeperDb.syncQueue.update(item.id, {
            status: 'conflict',
            updated_at: nowIso(),
            last_error: error?.message || 'Conflict detected',
            next_retry_at: null
          });
          continue;
        }

        const retryCount = (item.retry_count || 0) + 1;
        const retryAt = new Date(Date.now() + calculateBackoffMs(retryCount)).toISOString();
        await timekeeperDb.syncQueue.update(item.id, {
          status: 'failed',
          updated_at: nowIso(),
          retry_count: retryCount,
          last_error: error?.message || 'Sync failed',
          next_retry_at: retryAt
        });
      }
    }
  } finally {
    syncInProgress = false;
  }
};

export const startSyncLoop = (executor) => {
  if (syncLoopStarted || typeof window === 'undefined') return;
  syncLoopStarted = true;

  const trySync = () => {
    processSyncQueue(executor);
  };

  window.addEventListener('online', trySync);
  window.addEventListener('focus', trySync);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      trySync();
    }
  });

  window.setInterval(trySync, SYNC_INTERVAL_MS);
  trySync();
};

export const getSyncQueueStats = async () => {
  const [pending, failed, processing, conflict] = await Promise.all([
    timekeeperDb.syncQueue.where('status').equals('pending').count(),
    timekeeperDb.syncQueue.where('status').equals('failed').count(),
    timekeeperDb.syncQueue.where('status').equals('processing').count(),
    timekeeperDb.syncQueue.where('status').equals('conflict').count()
  ]);

  return {
    pending,
    failed,
    processing,
    conflict,
    total: pending + failed + processing + conflict
  };
};

export const getRecentQueueItems = async (limit = 100) => {
  const rows = await timekeeperDb.syncQueue.orderBy('created_at').reverse().limit(limit).toArray();
  return rows;
};

export const getOpenConflicts = async () => {
  const rows = await timekeeperDb.conflicts.where('resolved').equals(0).toArray();
  return rows.sort((a, b) => {
    const aTs = Date.parse(a?.created_at || '') || 0;
    const bTs = Date.parse(b?.created_at || '') || 0;
    return bTs - aTs;
  });
};

export const resolveConflict = async (conflictId, action = 'drop') => {
  const conflict = await timekeeperDb.conflicts.get(conflictId);
  if (!conflict) return;

  const queueItemId = conflict.queue_item_id;
  if (queueItemId) {
    if (action === 'retry') {
      await timekeeperDb.syncQueue.update(queueItemId, {
        status: 'pending',
        retry_count: 0,
        next_retry_at: null,
        updated_at: nowIso()
      });
    } else if (action === 'force') {
      const queueItem = await timekeeperDb.syncQueue.get(queueItemId);
      if (queueItem) {
        const payload = queueItem.payload || {};
        const entryId = conflict?.conflict_detail?.entry_id;

        if (Array.isArray(payload.entries)) {
          const nextEntries = payload.entries.map((entry) => {
            if (!entry || typeof entry !== 'object') return entry;
            if (entryId == null || Number(entry.entry_id) === Number(entryId)) {
              return { ...entry, force_apply: true };
            }
            return entry;
          });
          await timekeeperDb.syncQueue.update(queueItemId, {
            payload: { ...payload, entries: nextEntries },
            status: 'pending',
            retry_count: 0,
            next_retry_at: null,
            updated_at: nowIso()
          });
        } else {
          await timekeeperDb.syncQueue.update(queueItemId, {
            payload: { ...payload, force_apply: true },
            status: 'pending',
            retry_count: 0,
            next_retry_at: null,
            updated_at: nowIso()
          });
        }
      }
    } else {
      await timekeeperDb.syncQueue.update(queueItemId, {
        status: 'dropped',
        updated_at: nowIso()
      });
    }
  }

  await timekeeperDb.conflicts.update(conflictId, {
    resolved: 1,
    resolved_at: nowIso(),
    resolution_action: action
  });
};
