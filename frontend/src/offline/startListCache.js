import { timekeeperDb } from './db.js';
import { getQueuedEntryIds } from './entryTargets.js';
import { computeTimeSum } from './localEdits.js';

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
    // `updated_at` je SERVEROVÁ revize a musí zůstat nedotčená - posílá se
    // zpátky jako base_revision. Kdy jsme řádek uložili, říká jiné pole.
    cached_at: timestamp
  })));
};

/**
 * Přebije čerstvou odpověď ze serveru hodnotami, jejichž zápis ještě čeká
 * ve frontě.
 *
 * Bez tohohle stačí, aby GET vyhrál závod se synchronizací fronty, a čas,
 * který rozhodčí právě zadal, zmizí z obrazovky - server o něm ještě neví.
 */
const overlayUnsyncedEdits = async (rows) => {
  const queuedIds = await getQueuedEntryIds();
  if (!queuedIds.size) return rows;

  const merged = [];
  for (const row of rows) {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || !queuedIds.has(id)) {
      merged.push(row);
      continue;
    }

    const local = await timekeeperDb.startList.get(id);
    if (!local) {
      merged.push(row);
      continue;
    }

    const entry = {
      ...row,
      time1: local.time1 ?? null,
      time2: local.time2 ?? null,
      dnf: Boolean(local.dnf),
      dns: Boolean(local.dns),
      dsq: Boolean(local.dsq),
      updated_local_at: local.updated_local_at ?? null,
      updated_local_only: true
    };
    entry.time_sum = computeTimeSum(entry);
    merged.push(entry);
  }
  return merged;
};

/**
 * Zahodí lokální snímek závodu - nakešované odpovědi i řádky startovky.
 *
 * Volá se po nevratném smazání na serveru. Bez toho zůstane v IndexedDB
 * startovka i s časy, které už na serveru nejsou: stačí, aby tablet ztratil
 * signál, obrazovka Zadávání časů si je načte z cache jako platné a další
 * uložení je pošle zpátky na server.
 *
 * @param {number|string} raceId
 * @returns {Promise<{cache: number, entries: number}>} co se zahodilo
 */
export const dropRaceSnapshot = async (raceId) => {
  const numericId = Number(raceId);
  const prefix = `/api/timekeeper/races/${raceId}/`;

  const keys = await timekeeperDb.cache
    .filter((row) => typeof row.key === 'string' && row.key.startsWith(prefix))
    .primaryKeys();
  if (keys.length) await timekeeperDb.cache.bulkDelete(keys);

  const entries = Number.isFinite(numericId)
    ? await timekeeperDb.startList.where('race_id').equals(numericId).delete()
    : 0;

  return { cache: keys.length, entries };
};

/**
 * Uloží odpověď na GET a vrátí to, co se SKUTEČNĚ uložilo.
 *
 * Volající vrací tuhle návratovou hodnotu dál místo syrové odpovědi serveru -
 * jinak by se na obrazovku dostala data bez lokálních úprav.
 */
export const cacheGetResponse = async (endpoint, params = null, data = null) => {
  const key = buildCacheKey(endpoint, params);
  const raceId = parseRaceIdFromStartListEndpoint(endpoint);
  const stored = raceId != null && Array.isArray(data) ? await overlayUnsyncedEdits(data) : data;

  await timekeeperDb.cache.put({
    key,
    endpoint,
    params,
    data: stored,
    updated_at: nowIso()
  });

  if (endpoint === '/api/timekeeper/races') {
    await persistRaceSnapshot(stored);
  } else if (raceId != null) {
    await persistStartListSnapshot(raceId, stored);
  }

  return stored;
};
