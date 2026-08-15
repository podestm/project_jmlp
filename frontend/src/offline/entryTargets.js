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

// 'processing' patří mezi nesynchronizované záměrně: požadavek je sice na cestě,
// ale ještě nedoběhl, takže jeho revize na serveru zatím neplatí.
const UNSYNCED_STATUSES = ['pending', 'failed', 'processing'];

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
