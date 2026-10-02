import { timekeeperDb } from './db.js';

/**
 * Které řádky startovky daná mutace mění.
 *
 * Odpověď na tuhle otázku potřebuje skoro celá offline vrstva: čí zápis stojí
 * ve frontě, který zaparkovaný konflikt už je překonaný, kterou revizi zapsat
 * po synchronizaci. Proto je to jedno místo a ne čtyři podobné regexy.
 */
const SINGLE_ENTRY_ENDPOINT = /^\/api\/timekeeper\/start-list\/(\d+)(?:\/time)?$/;
const BATCH_TIMES_ENDPOINT = /^\/api\/timekeeper\/races\/(\d+)\/times$/;

/**
 * @returns {{ids: number[], batch: boolean}} `batch` odlišuje hromadný zápis
 *   časů - u něj server vrací revize po jednotlivých řádcích, takže jedna
 *   společná revize by byla přiřazena špatně.
 */
export const affectedEntryIds = (method, endpoint = '', payload = null) => {
  if (method === 'PUT') {
    const match = endpoint.match(SINGLE_ENTRY_ENDPOINT);
    if (match) return { ids: [Number(match[1])], batch: false };
  }

  if (method === 'POST' && BATCH_TIMES_ENDPOINT.test(endpoint) && Array.isArray(payload?.entries)) {
    return {
      // `> 0` schválně: Number(null) je 0, takže položka s prázdným entry_id
      // by jinak prošla jako fantomový řádek 0 a blokovala frontu pro id,
      // které neexistuje.
      ids: payload.entries
        .map((entry) => Number(entry?.entry_id))
        .filter((id) => Number.isFinite(id) && id > 0),
      batch: true
    };
  }

  return { ids: [], batch: false };
};

const EXCLUDED_ENDPOINT = /^\/api\/timekeeper\/start-list\/(\d+)\/excluded$/;

/**
 * Řádek, kterému zápis mění vyřazení ze startky, jinak null.
 *
 * Vyřazení je samostatná řada zápisů, a proto ho affectedEntryIds nevrací:
 * časy nemění a revizi řádku server neposouvá (viz start_list.py), takže se
 * se zápisy časů navzájem nečekají, nepřekonávají a po přehrání se do snímku
 * nezapisuje revize - ta z odpovědi na vyřazení nepatří k časům, které
 * zařízení zná. Mezi sebou ale pořadí držet musí: "Vyřadit" přehrané až po
 * "Vrátit" by závodníka vyřadilo natrvalo.
 */
export const excludedEntryId = (method, endpoint = '') => {
  if ((method || '').toUpperCase() !== 'PUT') return null;
  const match = (endpoint || '').match(EXCLUDED_ENDPOINT);
  return match ? Number(match[1]) : null;
};

/**
 * Klíče, podle kterých se zápisy řadí za sebe a navzájem překonávají.
 *
 * Časy (i úprava řádku) jednoho řádku sdílejí klíč `entry:<id>`, vyřazení
 * má vlastní `excluded:<id>` - viz excludedEntryId.
 */
export const mutationKeys = (method, endpoint = '', payload = null) => {
  const excludedId = excludedEntryId(method, endpoint);
  if (excludedId != null) return [`excluded:${excludedId}`];
  return affectedEntryIds((method || '').toUpperCase(), endpoint || '', payload)
    .ids.map((id) => `entry:${id}`);
};

// 'processing' patří mezi nesynchronizované záměrně: požadavek je sice na cestě,
// ale ještě nedoběhl, takže jeho revize na serveru zatím neplatí.
const UNSYNCED_STATUSES = ['pending', 'failed', 'processing'];

const getUnsyncedRows = () => timekeeperDb.syncQueue
  .where('status')
  .anyOf(UNSYNCED_STATUSES)
  .toArray();

/** Klíče (viz mutationKeys) všech zápisů, které ve frontě ještě čekají. */
export const getQueuedMutationKeys = async () => {
  const keys = new Set();
  for (const row of await getUnsyncedRows()) {
    mutationKeys(row.method, row.endpoint, row.payload).forEach((key) => keys.add(key));
  }
  return keys;
};

/**
 * Řádky, jejichž vyřazení nebo vrácení ve frontě ještě čeká. Čerstvá
 * odpověď serveru o nich zatím neví, takže platí lokální stav.
 */
export const getQueuedExcludedEntryIds = async () => {
  const ids = new Set();
  for (const row of await getUnsyncedRows()) {
    const id = excludedEntryId(row.method, row.endpoint);
    if (id != null) ids.add(id);
  }
  return ids;
};

/**
 * Řádky, které mají ve frontě nevyřízený zápis.
 *
 * Další úprava téhož řádku je vlastní oprava, ne souběžný zápis z jiného
 * zařízení, takže nesmí nést zastaralou `base_revision` - server by ji odmítl
 * s 409 a novější hodnota by čekala na ruční vyřešení konfliktu.
 */
export const getQueuedEntryIds = async () => {
  const rows = await timekeeperDb.syncQueue
    .where('status')
    .anyOf(UNSYNCED_STATUSES)
    .toArray();

  const ids = new Set();
  for (const row of rows) {
    const { ids: rowIds } = affectedEntryIds((row.method || '').toUpperCase(), row.endpoint || '', row.payload);
    rowIds.forEach((id) => ids.add(id));
  }
  return ids;
};

/**
 * Odstraní `base_revision` u řádků, které už mají zápis ve frontě.
 *
 * Fronta se přehrává v pořadí vzniku, takže tenhle zápis půjde až za tím
 * čekajícím - jeho představa o výchozí revizi je proto z definice zastaralá.
 */
export const stripSupersededRevisions = async (endpoint, payload) => {
  if (!payload || typeof payload !== 'object') return payload;

  const queuedIds = await getQueuedEntryIds();
  if (!queuedIds.size) return payload;

  if (Array.isArray(payload.entries)) {
    return {
      ...payload,
      entries: payload.entries.map((entry) => {
        if (entry?.entry_id != null && queuedIds.has(Number(entry.entry_id))) {
          const { base_revision, ...rest } = entry;
          return rest;
        }
        return entry;
      })
    };
  }

  const singleMatch = endpoint.match(SINGLE_ENTRY_ENDPOINT);
  if (singleMatch && queuedIds.has(Number(singleMatch[1]))) {
    const { base_revision, ...rest } = payload;
    return rest;
  }

  return payload;
};
