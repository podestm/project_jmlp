// Závodníci přidaní do startovky offline (dohláška na kopci bez signálu).
//
// Offline přidaný závodník dostane DOČASNÉ záporné id a hned se objeví ve
// startovce: jde mu zapsat čas, vyřadit ho i upravit - všechno jde do fronty
// s tím dočasným id. Zápis o přidání (POST .../start-list/entry) nese id
// v `client_temp_id` a ve frontě drží klíče entry:<tempId> i excluded:<tempId>
// (entryTargets.mutationKeys), takže se všechno navazující přehraje až po něm.
//
// Až server přidání přijme a vrátí skutečný řádek, remapTempEntry přepíše
// dočasné id na serverové: ve frontě (endpointy i dávky časů), v zaparkovaných
// konfliktech, ve snímku startovky, v nakešovaných odpovědích, v rozepsaných
// časech a v otevřených obrazovkách (ENTRY_REMAPPED_EVENT). Mapa dočasné ->
// serverové id zůstává uložená, aby i zápis, který obrazovka pošle se starým
// id o chvilku později, šel na správný řádek (resolveTempIds).
import { timekeeperDb } from './db.js';

export const TEMP_ENTRY_MAP_KEY = 'temp_entry_map';
export const ENTRY_REMAPPED_EVENT = 'timekeeper-entry-remapped';
export const LOCAL_ENTRY_ADDED_EVENT = 'timekeeper-local-entry-added';

const CREATE_ENDPOINT = /^\/api\/timekeeper\/races\/(\d+)\/start-list\/entry$/;
const ENTRY_IN_ENDPOINT = /\/start-list\/(-\d+)(?=\/|$)/;
const DRAFT_KEY_PREFIX = 'timing_drafts_';
// Zápisy, které už na server nepůjdou - ty se nepřepisují.
const FINISHED_STATUSES = new Set(['done', 'dropped', 'superseded']);

const nowIso = () => new Date().toISOString();

export const isTempEntryId = (id) => {
  const value = Number(id);
  return Number.isFinite(value) && value < 0;
};

/** Záporné, jedinečné a bezpečně celé (Date.now() * 1000 < 2^53). */
export const newTempEntryId = () => -(Date.now() * 1000 + Math.floor(Math.random() * 1000));

/** Dočasné id u zápisu "přidat závodníka do startovky", jinak null. */
export const createTempIdOf = (method, endpoint = '', payload = null) => {
  if ((method || '').toUpperCase() !== 'POST' || !CREATE_ENDPOINT.test(endpoint || '')) return null;
  return isTempEntryId(payload?.client_temp_id) ? Number(payload.client_temp_id) : null;
};

// --------------------------------------------------------------------------
// Mapa dočasné id -> serverové id
// --------------------------------------------------------------------------
export const getTempEntryMap = async () => {
  const row = await timekeeperDb.settings.get(TEMP_ENTRY_MAP_KEY);
  return row?.value && typeof row.value === 'object' ? row.value : {};
};

const rememberMapping = async (tempId, serverId) => {
  const map = await getTempEntryMap();
  map[String(tempId)] = serverId;
  await timekeeperDb.settings.put({ key: TEMP_ENTRY_MAP_KEY, value: map, updated_at: nowIso() });
};

/**
 * Nahradí dočasná id podle mapy v endpointu i v dávce časů.
 * @returns {{endpoint: string, payload: any, changed: boolean}}
 */
export const resolveTempIds = (endpoint, payload, map) => {
  let changed = false;
  let nextEndpoint = endpoint || '';
  const match = nextEndpoint.match(ENTRY_IN_ENDPOINT);
  if (match && map[match[1]] != null) {
    nextEndpoint = nextEndpoint.replace(ENTRY_IN_ENDPOINT, `/start-list/${map[match[1]]}`);
    changed = true;
  }
  let nextPayload = payload;
  if (payload && Array.isArray(payload.entries)) {
    let entriesChanged = false;
    const entries = payload.entries.map((entry) => {
      const mapped = entry && entry.entry_id != null ? map[String(entry.entry_id)] : undefined;
      if (mapped == null) return entry;
      entriesChanged = true;
      return { ...entry, entry_id: mapped };
    });
    if (entriesChanged) {
      nextPayload = { ...payload, entries };
      changed = true;
    }
  }
  return { endpoint: nextEndpoint, payload: nextPayload, changed };
};

/** resolveTempIds s uloženou mapou - pro zápisy vznikající na obrazovkách. */
export const resolveTempIdsStored = async (endpoint, payload) => {
  const map = await getTempEntryMap();
  if (!Object.keys(map).length) return { endpoint, payload, changed: false };
  return resolveTempIds(endpoint, payload, map);
};

// --------------------------------------------------------------------------
// Snímek startovky a nakešované odpovědi
// --------------------------------------------------------------------------
const startListCachePrefix = (raceId) => `/api/timekeeper/races/${raceId}/start-list`;

const updateStartListCache = async (raceId, transform) => {
  if (raceId == null) return;
  await timekeeperDb.transaction('rw', timekeeperDb.cache, async () => {
    const rows = await timekeeperDb.cache
      .where('key')
      .startsWith(startListCachePrefix(raceId))
      .toArray();
    for (const row of rows) {
      if (!Array.isArray(row.data)) continue;
      const data = transform(row.data);
      if (data !== row.data) await timekeeperDb.cache.put({ ...row, data, updated_at: nowIso() });
    }
  });
};

/**
 * Přidá offline závodníka do snímku i do nakešované startovky, takže ho
 * uvidí všechny obrazovky (i po obnovení stránky bez signálu).
 * Když už je dočasné id přemapované (fronta stihla odeslat dřív), nic nepřidá.
 */
export const addLocalEntry = async (raceId, entry) => {
  const map = await getTempEntryMap();
  if (map[String(entry.id)] != null) return false;
  const row = { ...entry, race_id: Number(raceId), local_temp: true, updated_local_at: nowIso() };
  await timekeeperDb.startList.put(row);
  await updateStartListCache(raceId, (data) =>
    data.some((item) => Number(item?.id) === Number(entry.id)) ? data : [...data, row],
  );
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(LOCAL_ENTRY_ADDED_EVENT, { detail: { raceId: Number(raceId), entry: row } }),
    );
  }
  return true;
};

/** Dočasné řádky závodu (pro doplnění do čerstvé odpovědi serveru). */
export const getLocalTempEntries = async (raceId) =>
  timekeeperDb.startList
    .where('race_id')
    .equals(Number(raceId))
    .filter((row) => isTempEntryId(row.id))
    .toArray();

const TIME_FIELDS = ['time1', 'time2', 'dnf', 'dns', 'dsq'];

const remapDrafts = async (raceId, tempId, serverId) => {
  const key = `${DRAFT_KEY_PREFIX}${Number(raceId) || 0}`;
  const row = await timekeeperDb.settings.get(key);
  const drafts = row?.value;
  if (!drafts || typeof drafts !== 'object' || !(String(tempId) in drafts)) return;
  const next = { ...drafts, [String(serverId)]: drafts[String(tempId)] };
  delete next[String(tempId)];
  await timekeeperDb.settings.put({ ...row, value: next, updated_at: nowIso() });
};

/**
 * Server přijal offline přidaného závodníka - dočasné id všude nahradit
 * serverovým. Lokálně zapsané časy a vyřazení zůstávají vidět (jejich zápisy
 * čekají ve frontě, už se serverovým id).
 *
 * @param {number} tempId
 * @param {object} serverEntry řádek startovky ze serveru (`entry` z odpovědi)
 */
export const remapTempEntry = async (tempId, serverEntry) => {
  const serverId = Number(serverEntry?.id);
  if (!isTempEntryId(tempId) || !Number.isFinite(serverId) || serverId <= 0) return null;
  const map = { [String(tempId)]: serverId };
  await rememberMapping(tempId, serverId);

  // Fronta a zaparkované konflikty.
  const queueRows = await timekeeperDb.syncQueue.toArray();
  for (const row of queueRows) {
    if (FINISHED_STATUSES.has(row.status)) continue;
    const { endpoint, payload, changed } = resolveTempIds(row.endpoint, row.payload, map);
    if (changed)
      await timekeeperDb.syncQueue.update(row.id, { endpoint, payload, updated_at: nowIso() });
  }
  const conflicts = await timekeeperDb.conflicts.where('resolved').equals(0).toArray();
  for (const conflict of conflicts) {
    const { endpoint, payload, changed } = resolveTempIds(conflict.endpoint, conflict.payload, map);
    if (changed) await timekeeperDb.conflicts.update(conflict.id, { endpoint, payload });
  }

  // Snímek startovky: serverový řádek, přes něj lokálně zapsané časy a vyřazení.
  const temp = await timekeeperDb.startList.get(Number(tempId));
  const raceId = Number(serverEntry.race_id ?? temp?.race_id);
  const merged = { ...serverEntry, race_id: raceId };
  if (temp) {
    const hasLocalTimes = TIME_FIELDS.some((field) => temp[field] != null && temp[field] !== false);
    if (hasLocalTimes) {
      TIME_FIELDS.forEach((field) => {
        merged[field] = temp[field] ?? null;
      });
      merged.updated_local_only = true;
      merged.updated_local_at = temp.updated_local_at ?? nowIso();
    }
    if (temp.excluded) merged.excluded = true;
    await timekeeperDb.startList.delete(Number(tempId));
  }
  await timekeeperDb.startList.put(merged);
  await updateStartListCache(raceId, (data) => {
    if (!data.some((item) => Number(item?.id) === Number(tempId))) return data;
    // Bez řádku se serverovým id - pokud tam závodník už byl (spojení
    // s existujícím záznamem), zůstane jen jednou.
    return data
      .filter((item) => Number(item?.id) !== serverId)
      .map((item) => (Number(item?.id) === Number(tempId) ? merged : item));
  });
  await remapDrafts(raceId, tempId, serverId);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(ENTRY_REMAPPED_EVENT, {
        detail: { tempId: Number(tempId), serverId, entry: merged },
      }),
    );
  }
  return merged;
};

/**
 * Přidání offline závodníka bylo zahozeno (Drop v Sync centru) - dočasný
 * řádek zmizí ze startovky. Navazující zápisy (časy, vyřazení) bez něj
 * nemají kam dorazit; vrací se, ať je volající zahodí taky.
 */
export const removeLocalEntry = async (tempId) => {
  const temp = await timekeeperDb.startList.get(Number(tempId));
  if (!temp) return null;
  await timekeeperDb.startList.delete(Number(tempId));
  await updateStartListCache(temp.race_id, (data) => {
    const next = data.filter((item) => Number(item?.id) !== Number(tempId));
    return next.length === data.length ? data : next;
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(ENTRY_REMAPPED_EVENT, {
        detail: { tempId: Number(tempId), serverId: null, entry: null },
      }),
    );
  }
  return temp;
};

/**
 * Přemapuje id ve stavu obrazovky: řádek startovky i klíče map podle id.
 * @param {Array} entries
 * @param {{tempId: number, serverId: number|null, entry: object|null}} detail
 */
export const remapEntriesInState = (entries, { tempId, serverId, entry }) => {
  if (!Array.isArray(entries) || !entries.some((item) => Number(item?.id) === Number(tempId)))
    return entries;
  if (serverId == null) return entries.filter((item) => Number(item?.id) !== Number(tempId));
  const withoutDuplicate = entries.filter((item) => Number(item?.id) !== serverId);
  return withoutDuplicate.map((item) =>
    Number(item?.id) === Number(tempId) ? { ...item, ...entry } : item,
  );
};

export const renameKey = (object, fromId, toId) => {
  if (!object || !(String(fromId) in object)) return object;
  const next = { ...object };
  if (toId != null) next[String(toId)] = next[String(fromId)];
  delete next[String(fromId)];
  return next;
};
