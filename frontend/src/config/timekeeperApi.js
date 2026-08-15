// Timekeeper API - offline-first client with its own token and sync queue.
// Kept out of config/api.js so that public pages never pull in Dexie/IndexedDB.
import {
  API_CONFIG,
  buildUrl,
  handleTimekeeperAuthError,
  timekeeperAuthHeaders
} from './api.js';
import { cacheGetResponse, readCachedResponse } from '../offline/startListCache.js';
import { applyLocalMutation, revisionsFromResponse } from '../offline/localEdits.js';
import {
  enqueueMutation,
  generateOpId,
  hasUnsyncedMutationFor,
  supersedeParkedOpsFor
} from '../offline/syncQueue.js';
import { processSyncQueue, startSyncLoop } from '../offline/sync.js';

const extractStatusFromError = (error) => {
  if (typeof error?.status === 'number') return error.status;
  if (!error?.message) return null;
  const match = error.message.match(/API Error: (\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

const isNetworkError = (error) => {
  const message = error?.message || '';
  return (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Load failed')
  );
};

const isAuthError = (status) => status === 401 || status === 403;

/**
 * A 5xx means the write never reached the database - the backend restarted, the
 * pool was exhausted, nginx answered for a container that was not there. That is
 * a transport failure with an HTTP status stapled to it, not a rejection, so it
 * belongs in the offline queue exactly like a dropped connection: the operator
 * must not have to re-type a measured time because the API blipped mid-race.
 *
 * Deliberately NOT every non-2xx. A 4xx (409 above all) is the server saying no
 * on purpose; replaying that blindly would loop until the row goes 'dead'.
 */
const RETRIABLE_SERVER_STATUSES = new Set([500, 502, 503, 504]);
const isRetriableServerError = (status) => RETRIABLE_SERVER_STATUSES.has(status);

/**
 * @param {boolean} [options.background] true for requests nobody is waiting on -
 *   the sync loop. A 401 on one of those must not navigate the tab: that would
 *   close the Web Serial port mid-race. See createAuthErrorHandler in api.js.
 */
const timekeeperFetch = async (
  method,
  endpoint,
  data = null,
  params = null,
  extraHeaders = {},
  { background = false } = {}
) => {
  const response = await fetch(buildUrl(endpoint, params || {}), {
    method,
    headers: {
      ...API_CONFIG.DEFAULT_HEADERS,
      ...timekeeperAuthHeaders(),
      ...extraHeaders
    },
    ...(data != null ? { body: JSON.stringify(data) } : {}),
    redirect: 'follow'
  });

  if (!response.ok) {
    handleTimekeeperAuthError(response.status, { background });
    let parsedDetail = null;
    try {
      parsedDetail = await response.json();
    } catch {
      parsedDetail = null;
    }

    const error = new Error(`API Error: ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.detail = parsedDetail?.detail || parsedDetail || null;
    throw error;
  }

  return response.json();
};

const opts = (meta = {}) => ({ background: Boolean(meta.background) });

const TimekeeperAPIOnline = {
  get: async (endpoint, params = {}, meta = {}) => timekeeperFetch('GET', endpoint, null, params, {}, opts(meta)),
  post: async (endpoint, data = {}, meta = {}) => timekeeperFetch('POST', endpoint, data, null, meta.headers || {}, opts(meta)),
  put: async (endpoint, data = {}, meta = {}) => timekeeperFetch('PUT', endpoint, data, null, meta.headers || {}, opts(meta)),
  delete: async (endpoint, meta = {}) => timekeeperFetch('DELETE', endpoint, null, null, meta.headers || {}, opts(meta))
};

const queueMutationWithLocalApply = async (method, endpoint, data = null, opId = null) => {
  await applyLocalMutation(method, endpoint, data);
  const item = await enqueueMutation(method, endpoint, data, opId);
  // op_id / queue_id are returned so a caller can follow this exact mutation to
  // 'done' or 'dead' instead of guessing which queue row was its own - the
  // timing inbox uses them to decide when a confirmed time is really written.
  return {
    queued: true,
    offline: true,
    op_id: item.op_id,
    queue_id: item.id,
    message: 'Změna byla uložena lokálně a čeká na synchronizaci.'
  };
};

/**
 * Replay one queued mutation.
 *
 * Two things it must do beyond sending the request:
 *  - flag itself as BACKGROUND, so a 401 parks the queue and raises the
 *    re-login banner instead of navigating the tab (which would close the Web
 *    Serial port mid-race);
 *  - RETURN the server response. It carries the revision the server produced,
 *    and processSyncQueue writes it into the local snapshot. Throwing it away
 *    left the snapshot on the pre-offline revision, so the next write to that
 *    entry was a guaranteed 409 that no screen could recover from.
 */
const syncExecutor = async (item) => {
  const method = (item.method || '').toUpperCase();
  const headers = item.op_id ? { 'X-Idempotency-Key': item.op_id } : {};
  const meta = { headers, background: true };

  if (method === 'POST') return TimekeeperAPIOnline.post(item.endpoint, item.payload || {}, meta);
  if (method === 'PUT') return TimekeeperAPIOnline.put(item.endpoint, item.payload || {}, meta);
  if (method === 'DELETE') return TimekeeperAPIOnline.delete(item.endpoint, meta);
  return null;
};

/**
 * Starts the background sync loop. Called from TimekeeperAuthProvider once a
 * timekeeper is authenticated - never at module scope, so public visitors
 * neither open IndexedDB nor run a 10s timer.
 *
 * @returns {function} teardown
 */
export const startTimekeeperSync = () => startSyncLoop(syncExecutor);

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

// POST/PUT/DELETE share the same online-try / offline-queue decision.
const mutate = async (method, endpoint, data) => {
  const opId = generateOpId();
  if (!isOnline()) {
    return queueMutationWithLocalApply(method, endpoint, data, opId);
  }

  // Connectivity is back but the queue has not drained yet: a write to an entry
  // that still has an unsynced op MUST go behind it. Sent directly it would land
  // first and the older replay would then overwrite the newer measured time.
  if (await hasUnsyncedMutationFor(method, endpoint, data)) {
    const queued = await queueMutationWithLocalApply(method, endpoint, data, opId);
    // Do not make the operator wait for the 10 s tick to see it clear.
    processSyncQueue(syncExecutor).catch(() => {});
    return queued;
  }

  try {
    const headers = { 'X-Idempotency-Key': opId };
    const result = method === 'POST'
      ? await TimekeeperAPIOnline.post(endpoint, data, { headers })
      : method === 'PUT'
        ? await TimekeeperAPIOnline.put(endpoint, data, { headers })
        : await TimekeeperAPIOnline.delete(endpoint, { headers });

    // Keep the local snapshot in step with what the server just accepted, so a
    // reload (online or offline) shows the value the operator entered. The
    // server's own revision goes with it - a client clock in that field would
    // make the next write's base_revision bogus and earn a 409.
    await applyLocalMutation(method, endpoint, data, {
      syncedRemote: true,
      // Endpoints whose payload is not the row itself (bib reassignment) need
      // the server's own view of the row - the request body alone would leave a
      // half-updated race-number snapshot behind.
      serverEntry: result?.entry ?? null,
      ...revisionsFromResponse(result),
    });
    // This write supersedes anything parked in 'conflict'/'dead' for the same
    // entry. Left alone, a later "Force" in the Sync Center would replay that
    // older payload straight over the value just written.
    await supersedeParkedOpsFor(method, endpoint, data);
    return result;
  } catch (error) {
    const status = extractStatusFromError(error);
    if (status && isAuthError(status)) {
      throw error;
    }
    // Same `opId` as the request that just failed, so the X-Idempotency-Key the
    // replay carries is the one the backend may already have seen: if the 5xx
    // came back after the write had actually landed, the replay de-duplicates
    // instead of applying twice.
    if (isNetworkError(error) || isRetriableServerError(status)) {
      return queueMutationWithLocalApply(method, endpoint, data, opId);
    }
    throw error;
  }
};

export const TimekeeperAPI = {
  get: async (endpoint, params = {}) => {
    if (isOnline()) {
      try {
        const data = await TimekeeperAPIOnline.get(endpoint, params);
        // Return what was actually STORED, not the raw server payload: rows
        // whose write is still queued keep their local values, so a GET that
        // wins the race against the queue drain can no longer wipe a time the
        // operator has already entered off the screen.
        const stored = await cacheGetResponse(endpoint, params, data);
        return stored === undefined ? data : stored;
      } catch (error) {
        const status = extractStatusFromError(error);
        if (status && isAuthError(status)) {
          throw error;
        }

        const cached = await readCachedResponse(endpoint, params);
        if (cached != null) {
          return cached;
        }

        throw error;
      }
    }

    const cached = await readCachedResponse(endpoint, params);
    if (cached != null) {
      return cached;
    }

    throw new Error('Offline režim: data nejsou dostupná v lokální cache.');
  },

  post: async (endpoint, data = {}) => mutate('POST', endpoint, data),
  put: async (endpoint, data = {}) => mutate('PUT', endpoint, data),
  delete: async (endpoint) => mutate('DELETE', endpoint, null),

  flushQueue: async () => {
    await processSyncQueue(syncExecutor);
  }
};

export default TimekeeperAPI;
