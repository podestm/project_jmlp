import { timekeeperDb } from './db.js';
import { affectedEntryIds, excludedEntryId } from './entryTargets.js';

const nowIso = () => new Date().toISOString();

/**
 * Nese mapu id -> nová revize po přehrání fronty.
 *
 * Obrazovka zadávání časů si drží startovku ve vlastním stavu, takže by o nových
 * revizích jinak nevěděla a další zápis do téhož řádku by poslal zastaralý
 * base_revision - jistý 409 na řádku, na který nikdo jiný nesahal.
 *
 * Konstanta je schválně tady, u vysílače, a posluchač si ji importuje: dvě
 * kopie řetězce se dřív nebo později rozejdou a rozpojení nic neohlásí.
 */
export const START_LIST_REVISION_EVENT = 'timekeeper-start-list-revision';

/**
 * Zrcadlí backend/app/routers/timekeeper/timing.py: jakýkoli příznak součet
 * ruší, jinak je to součet těch polovin, které jsou zadané.
 */
export const computeTimeSum = (entry) => {
  if (entry.dnf || entry.dns || entry.dsq) return null;
  const t1 = entry.time1 == null ? null : Number(entry.time1);
  const t2 = entry.time2 == null ? null : Number(entry.time2);
  if (t1 != null && t2 != null) return t1 + t2;
  if (t1 != null) return t1;
  if (t2 != null) return t2;
  return null;
};

/**
 * Použije `updater` na lokálně uložený řádek startovky.
 * @returns {object|null} upravený řádek, nebo null když v cache není
 */
export const updateStartListEntry = async (entryId, updater) => {
  const existing = await timekeeperDb.startList.get(entryId);
  if (!existing) return null;
  const next = updater(existing);
  next.time_sum = computeTimeSum(next);
  await timekeeperDb.startList.put(next);
  return next;
};

/**
 * Promítne lokální úpravy do uložené odpovědi na GET.
 *
 * Čtecí cesta vrací řádky jen z tabulky `cache`, takže bez tohohle by offline
 * úprava zůstala v `startList`, odkud ji nikdo nečte - a obnovení stránky bez
 * signálu by tiše zahodilo každý zadaný čas.
 *
 * Bere všechny opravy pro jeden závod najednou a běží v transakci: čtení a
 * zápis po jednom řádku by se navzájem přepisovaly, protože všechny přepisují
 * tentýž řádek cache.
 *
 * @param {number} raceId
 * @param {Map<number, object>} patchesById id řádku -> celý nový řádek
 */
export const writeThroughStartListCache = async (raceId, patchesById) => {
  if (raceId == null || !patchesById.size) return;
  const prefix = `/api/timekeeper/races/${raceId}/start-list`;

  await timekeeperDb.transaction('rw', timekeeperDb.cache, async () => {
    const rows = await timekeeperDb.cache.where('key').startsWith(prefix).toArray();

    for (const row of rows) {
      if (!Array.isArray(row.data)) continue;
      let changed = false;
      const data = row.data.map((item) => {
        const patch = patchesById.get(Number(item?.id));
        if (!patch) return item;
        changed = true;
        const merged = { ...item, ...patch };
        return { ...merged, time_sum: computeTimeSum(merged) };
      });
      if (changed) {
        await timekeeperDb.cache.put({ ...row, data, updated_at: nowIso() });
      }
    }
  });
};

/**
 * Revize, které server vrátil k právě přijatému zápisu.
 *
 * Jednotlivý zápis vrací `revision` (nebo celý `entry`), hromadný vrací mapu
 * id -> revize. Tvar odpovědi se liší podle endpointu, proto to čte jedna
 * funkce a ne každé volající místo po svém.
 */
export const revisionsFromResponse = (result) => ({
  serverRevision: result?.revision ?? result?.entry?.updated_at ?? null,
  serverRevisions:
    result && typeof result.revisions === 'object' && result.revisions !== null
      ? result.revisions
      : null
});

/**
 * Promítne mutaci do lokálního snímku.
 *
 * `updated_at` nese SERVEROVOU revizi a právě ta se posílá zpátky jako
 * base_revision při dalším zápisu, takže se do ní nikdy nesmí dostat lokálně
 * vyrobené razítko - backend by další zápis odmítl s 409. Offline si držíme
 * poslední známou serverovou revizi, online bereme tu čerstvou. Čas lokální
 * úpravy žije v `updated_local_at`.
 *
 * @param {string|null} [options.serverRevision] revize u jednotlivého zápisu
 * @param {object|null} [options.serverRevisions] mapa id -> revize u hromadného
 * @param {object|null} [options.serverEntry] serverova podoba řádku tam, kde
 *   tělo požadavku není sám řádek (přečíslování startovních čísel)
 */
export const applyLocalMutation = async (
  method,
  endpoint,
  payload = null,
  { syncedRemote = false, serverRevision = null, serverRevisions = null, serverEntry = null } = {}
) => {
  const localOnly = !syncedRemote;

  const revisionOf = (entry, entryId, { batch = false } = {}) => {
    if (!syncedRemote) return entry.updated_at ?? null;
    if (serverRevisions) {
      const revision = serverRevisions[entryId] ?? serverRevisions[String(entryId)];
      if (revision !== undefined) return revision ?? null;
    }
    // U hromadného zápisu bez mapy revizí nemáme čím řádek orazítkovat.
    // Prázdná revize znamená "zeptej se serveru", což je bezpečné; cizí revize
    // by znamenala jistý 409 při dalším zápisu.
    return !batch && serverRevision ? serverRevision : null;
  };

  const writeEntry = async (entryId, changes, options) => {
    const updated = await updateStartListEntry(entryId, (entry) => ({
      ...entry,
      ...changes,
      updated_at: revisionOf(entry, entryId, options),
      updated_local_at: nowIso(),
      updated_local_only: localOnly
    }));
    if (updated) {
      await writeThroughStartListCache(updated.race_id, new Map([[entryId, updated]]));
    }
  };

  // Vyřazení ze startky mění jen příznak, a to offline i online - jinak by
  // obrazovky bez signálu vyřazeného dál ukazovaly. Revizi ani časy z odpovědi
  // do snímku nepouštíme: server revizi vyřazením neposouvá a časy v odpovědi
  // můžou být novější než ty, ke kterým zařízení revizi drží.
  const excludedId = excludedEntryId(method, endpoint);
  if (excludedId != null) {
    const excluded = Boolean(serverEntry ? serverEntry.excluded : payload?.excluded);
    const updated = await updateStartListEntry(excludedId, (entry) => ({ ...entry, excluded }));
    if (updated) {
      await writeThroughStartListCache(updated.race_id, new Map([[excludedId, { excluded }]]));
    }
    return;
  }

  if (method === 'PUT') {
    const timeMatch = endpoint.match(/^\/api\/timekeeper\/start-list\/(\d+)\/time$/);
    if (timeMatch) {
      await writeEntry(Number(timeMatch[1]), payload, {});
      return;
    }

    // Zápis na řádek bez /time mění startovní číslo. Tělo požadavku není celý
    // řádek, takže bez serverovy podoby není co promítnout - offline se tahle
    // změna do snímku nedostane vůbec.
    const entryMatch = endpoint.match(/^\/api\/timekeeper\/start-list\/(\d+)$/);
    if (entryMatch && serverEntry) {
      await writeEntry(Number(entryMatch[1]), serverEntry, {});
    }
    return;
  }

  if (method === 'POST') {
    const batchMatch = endpoint.match(/^\/api\/timekeeper\/races\/(\d+)\/times$/);
    if (!batchMatch || !Array.isArray(payload?.entries)) return;

    const raceId = Number(batchMatch[1]);
    const timestamp = nowIso();
    const patches = new Map();

    // Postupně: každý průchod čte a přepisuje tentýž řádek cache.
    for (const item of payload.entries) {
      if (!item || !item.entry_id) continue;
      const entryId = Number(item.entry_id);
      const updated = await updateStartListEntry(entryId, (entry) => ({
        ...entry,
        time1: item.time1,
        time2: item.time2,
        dnf: Boolean(item.dnf),
        dns: Boolean(item.dns),
        dsq: Boolean(item.dsq),
        updated_at: revisionOf(entry, entryId, { batch: true }),
        updated_local_at: timestamp,
        updated_local_only: localOnly
      }));
      if (updated) patches.set(entryId, updated);
    }

    await writeThroughStartListCache(raceId, patches);
  }
};

/**
 * Zapíše do snímku revize, které server vrátil na přehraný zápis z fronty.
 *
 * Bez tohohle zůstane snímek na revizi z doby před výpadkem a další zápis do
 * téhož řádku je zaručené 409, ze kterého se žádná obrazovka nedostane.
 * Selhání se schválně polyká: synchronizace samotná proběhla úspěšně a shodit
 * ji kvůli zápisu do cache by bylo horší než mít o revizi méně.
 */
export const applySyncedRevisions = async (queueItem, response) => {
  try {
    const method = (queueItem.method || '').toUpperCase();
    const { ids, batch } = affectedEntryIds(method, queueItem.endpoint, queueItem.payload);
    if (!ids.length) return;

    const { serverRevision, serverRevisions } = revisionsFromResponse(response);
    const patchesByRace = new Map();
    const appliedRevisions = {};

    for (const entryId of ids) {
      let revision = null;
      if (serverRevisions) {
        const found = serverRevisions[entryId] ?? serverRevisions[String(entryId)];
        if (found !== undefined) revision = found ?? null;
      } else if (!batch) {
        revision = serverRevision ?? null;
      }
      appliedRevisions[entryId] = revision;

      const updated = await updateStartListEntry(entryId, (entry) => ({
        ...entry,
        updated_at: revision,
        updated_local_only: false
      }));
      if (!updated) continue;

      const raceId = updated.race_id ?? null;
      if (!patchesByRace.has(raceId)) patchesByRace.set(raceId, new Map());
      patchesByRace.get(raceId).set(entryId, updated);
    }

    for (const [raceId, patches] of patchesByRace.entries()) {
      await writeThroughStartListCache(raceId, patches);
    }

    if (typeof window !== 'undefined' && Object.keys(appliedRevisions).length) {
      window.dispatchEvent(new CustomEvent(START_LIST_REVISION_EVENT, {
        detail: { revisions: appliedRevisions }
      }));
    }
  } catch {
    // viz komentář výše
  }
};
