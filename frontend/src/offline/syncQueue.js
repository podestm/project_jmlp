import { timekeeperDb } from './db.js';
import {
  excludedEntryId,
  getQueuedMutationKeys,
  mutationKeys,
  stripSupersededRevisions
} from './entryTargets.js';

export const MAX_RETRIES = 8;
// Požadavek, který visí v 'processing' déle, osiřel po obnovení stránky nebo
// pádu karty. S rezervou nad nejpomalejším reálným požadavkem.
const PROCESSING_STALE_MS = 120000;

// Vysílá se při každé změně fronty, aby se odznak v UI aktualizoval bez
// častějšího dotazování.
export const SYNC_QUEUE_EVENT = 'timekeeper-sync-queue-changed';

const nowIso = () => new Date().toISOString();

export const notifyQueueChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_QUEUE_EVENT));
  }
};

export const generateOpId = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
);

const createQueueItem = (method, endpoint, payload = null, opId = null) => ({
  op_id: opId || generateOpId(),
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

export const enqueueMutation = async (method, endpoint, payload = null, opId = null) => {
  const safePayload = await stripSupersededRevisions(endpoint, payload);
  const item = createQueueItem(method, endpoint, safePayload, opId);
  const id = await timekeeperDb.syncQueue.add(item);
  notifyQueueChanged();
  return { ...item, id };
};

/**
 * Má některý z dotčených řádků nevyřízený zápis ve frontě?
 *
 * Když ano, musí i tenhle zápis do fronty za něj. Poslaný rovnou by dorazil
 * první a starší přehrávka by pak novější naměřený čas přepsala.
 *
 * Porovnává se podle mutationKeys: čas čeká za časem, vyřazení za vyřazením.
 */
export const hasUnsyncedMutationFor = async (method, endpoint, payload) => {
  const keys = mutationKeys(method, endpoint, payload);
  if (!keys.length) return false;

  const queuedKeys = await getQueuedMutationKeys();
  return queuedKeys.size ? keys.some((key) => queuedKeys.has(key)) : false;
};

/**
 * Označí zaparkované zápisy (konflikt / mrtvé) pro tytéž řádky za překonané.
 *
 * Bez toho by pozdější „Vynutit" v Centru synchronizace přehrálo starou dávku
 * rovnou přes hodnotu, která už je zapsaná.
 *
 * Překonává se jen stejný druh zápisu (mutationKeys): vyřazení ze startky
 * neruší zaparkovaný čas téhož závodníka a zápis času neruší vyřazení.
 *
 * @param {string|null} [createdBefore] parkovat jen zápisy starší než tenhle
 *   okamžik - při přehrávání fronty je to čas vzniku právě odeslané položky,
 *   aby se nesmazalo něco, co vzniklo až po ní.
 * @returns {number} kolik položek bylo označeno
 */
export const supersedeParkedOpsFor = async (method, endpoint, payload, createdBefore = null) => {
  const keys = mutationKeys(method, endpoint, payload);
  if (!keys.length) return 0;

  const targetKeys = new Set(keys);
  const parked = await timekeeperDb.syncQueue.where('status').anyOf('conflict', 'dead').toArray();
  const cutoff = createdBefore ? Date.parse(createdBefore) : Number.POSITIVE_INFINITY;

  const superseded = parked.filter((row) => {
    const rowKeys = mutationKeys(row.method, row.endpoint, row.payload);
    if (!rowKeys.some((key) => targetKeys.has(key))) return false;
    if (!Number.isFinite(cutoff)) return true;
    const createdAt = Date.parse(row.created_at || '');
    return Number.isFinite(createdAt) && createdAt < cutoff;
  });

  if (!superseded.length) return 0;

  const reason = excludedEntryId(method, endpoint) != null
    ? 'Nahrazeno novějším vyřazením či vrácením téhož závodníka.'
    : 'Nahrazeno novějším zápisem téhož času.';

  await Promise.all(superseded.map(async (row) => {
    await timekeeperDb.syncQueue.update(row.id, {
      status: 'superseded',
      updated_at: nowIso(),
      last_error: reason
    });

    const open = await timekeeperDb.conflicts
      .where('queue_item_id').equals(row.id)
      .filter((conflict) => !conflict.resolved)
      .toArray();

    await Promise.all(open.map((conflict) => timekeeperDb.conflicts.update(conflict.id, {
      resolved: 1,
      resolved_at: nowIso(),
      resolution_action: 'superseded'
    })));
  }));

  notifyQueueChanged();
  return superseded.length;
};

/**
 * Vrátí do fronty řádky opuštěné uprostřed odesílání (zavřená karta, reload).
 * Počet pokusů se schválně nenuluje, aby se opravdu selhávající položka pořád
 * dobrala stavu 'dead'. Přeposlat je bezpečné - každá nese klíč idempotence.
 */
export const recoverStaleProcessing = async () => {
  const cutoff = Date.now() - PROCESSING_STALE_MS;
  const rows = await timekeeperDb.syncQueue.where('status').equals('processing').toArray();
  const stale = rows.filter((row) => {
    const ts = Date.parse(row.updated_at || '');
    return Number.isNaN(ts) || ts <= cutoff;
  });

  await Promise.all(stale.map((row) => timekeeperDb.syncQueue.update(row.id, {
    status: 'pending',
    next_retry_at: null,
    updated_at: nowIso()
  })));

  return stale.length;
};

/**
 * Všechny nevyřízené zápisy v pořadí vzniku, každý s příznakem, jestli mu už
 * uplynul odklad.
 *
 * Schválně NEfiltrované. `stripSupersededRevisions` zahazuje base_revision
 * pozdějšího zápisu právě proto, že se fronta přehrává v pořadí vzniku - takže
 * to pořadí musí přehrávací smyčka opravdu dodržet. Vyhodit tady položky, na
 * které ještě nedošla řada, to tiše rozbilo: odložený zápis se přeskočil,
 * pozdější pro tentýž řádek šel první a když starší nakonec doběhl, přepsal
 * opravený čas a nebyla revize, která by ho zastavila.
 */
export const getQueueCandidates = async () => {
  const rows = await timekeeperDb.syncQueue
    .where('status')
    .anyOf('pending', 'failed')
    .sortBy('created_at');

  const currentTs = Date.now();
  return rows.map((row) => {
    let ready = true;
    if (row.next_retry_at) {
      const retryTs = Date.parse(row.next_retry_at);
      // Poškozené razítko → zkusit hned, ne ho navždy tiše přeskakovat.
      ready = Number.isNaN(retryTs) ? true : retryTs <= currentTs;
    }
    return { row, ready };
  });
};

export const saveConflict = async (queueItem, error, statusCode) => {
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

export const getSyncQueueStats = async () => {
  const [pending, failed, processing, conflict, dead] = await Promise.all([
    timekeeperDb.syncQueue.where('status').equals('pending').count(),
    timekeeperDb.syncQueue.where('status').equals('failed').count(),
    timekeeperDb.syncQueue.where('status').equals('processing').count(),
    timekeeperDb.syncQueue.where('status').equals('conflict').count(),
    timekeeperDb.syncQueue.where('status').equals('dead').count()
  ]);

  return {
    pending,
    failed,
    processing,
    conflict,
    dead,
    total: pending + failed + processing + conflict + dead
  };
};

export const getRecentQueueItems = async (limit = 100) => (
  timekeeperDb.syncQueue.orderBy('created_at').reverse().limit(limit).toArray()
);

/**
 * Ruční „Zkusit znovu" z Centra synchronizace.
 *
 * Zaparkovaný zápis (dead / failed) se vrací do fronty s vynulovaným počtem
 * pokusů - jinak by ho přehrávací smyčka podle `MAX_RETRIES` okamžitě zase
 * odsoudila k 'dead' a tlačítko by nedělalo nic. Odklad i poslední chyba se
 * mažou, aby řádek nečekal na odklad z minulého kola.
 */
export const retryQueueItem = async (queueItemId) => {
  await timekeeperDb.syncQueue.update(queueItemId, {
    status: 'pending',
    retry_count: 0,
    next_retry_at: null,
    last_error: null,
    updated_at: nowIso()
  });
  notifyQueueChanged();
};

export const getOpenConflicts = async () => {
  const rows = await timekeeperDb.conflicts.where('resolved').equals(0).toArray();
  return rows.sort((a, b) => {
    const aTs = Date.parse(a?.created_at || '') || 0;
    const bTs = Date.parse(b?.created_at || '') || 0;
    return bTs - aTs;
  });
};

/** Doplní `force_apply` tam, kde se konflikt řeší vynucením zápisu. */
const forcePayload = (payload, entryId) => {
  if (Array.isArray(payload.entries)) {
    return {
      ...payload,
      entries: payload.entries.map((entry) => {
        if (!entry || typeof entry !== 'object') return entry;
        if (entryId == null || Number(entry.entry_id) === Number(entryId)) {
          return { ...entry, force_apply: true };
        }
        return entry;
      })
    };
  }
  return { ...payload, force_apply: true };
};

export const resolveConflict = async (conflictId, action = 'drop') => {
  const conflict = await timekeeperDb.conflicts.get(conflictId);
  if (!conflict) return;

  const queueItemId = conflict.queue_item_id;
  if (queueItemId) {
    const requeue = {
      status: 'pending',
      retry_count: 0,
      next_retry_at: null,
      updated_at: nowIso()
    };

    if (action === 'retry') {
      await timekeeperDb.syncQueue.update(queueItemId, requeue);
    } else if (action === 'force') {
      const queueItem = await timekeeperDb.syncQueue.get(queueItemId);
      if (queueItem) {
        await timekeeperDb.syncQueue.update(queueItemId, {
          ...requeue,
          payload: forcePayload(queueItem.payload || {}, conflict?.conflict_detail?.entry_id)
        });
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
  notifyQueueChanged();
};
