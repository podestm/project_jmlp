import { isNetworkError, isOnline, markUnreachable, onBackOnline } from './connectivity.js';
import { timekeeperDb } from './db.js';
import { mutationKeys } from './entryTargets.js';
import { applySyncedRevisions } from './localEdits.js';
import { createTempIdOf, remapTempEntry } from './offlineEntries.js';
import {
  getQueueCandidates,
  MAX_RETRIES,
  notifyQueueChanged,
  recoverStaleProcessing,
  reviveNetworkFailures,
  saveConflict,
  supersedeParkedOpsFor
} from './syncQueue.js';

const SYNC_INTERVAL_MS = 10000;
// Jen jedna karta synchronizuje; starší zápůjčka se považuje za opuštěnou.
const LEADER_LEASE_KEY = 'timekeeper_sync_leader';
const LEADER_LEASE_TTL_MS = SYNC_INTERVAL_MS * 3;

export const AUTH_EXPIRED_MESSAGE = 'Přihlášení vypršelo – fronta čeká na nové přihlášení.';

let syncLoopStarted = false;
let syncInProgress = false;

const tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const nowIso = () => new Date().toISOString();

const calculateBackoffMs = (retryCount) => (2 ** Math.min(retryCount, 6)) * 1000;

/**
 * Odmítnutí serverem, které opakování nespraví: obsazené startovní číslo,
 * závodník už na startovce, neexistující řádek, souběžná změna (409).
 * Takový zápis jde rovnou do Sync centra jako konflikt - nikdy se tiše
 * neztratí ani se zbytečně nepřehrává do 'dead'.
 */
const CONFLICT_STATUSES = new Set([400, 404, 409, 422]);

const extractStatusCode = (error) => {
  if (typeof error?.status === 'number') return error.status;
  if (!error?.message) return null;
  const match = error.message.match(/API Error: (\d+)/);
  return match ? Number(match[1]) : null;
};

/**
 * Přehraje frontu.
 *
 * Zápisy pro tentýž řádek se musí odbavit v pořadí vzniku. Jakmile se jeden
 * zasekne (čeká na odklad, spadl do konfliktu, došly pokusy), musí se všechny
 * pozdější zápisy pro tentýž řádek zastavit za ním - jinak by novější hodnota
 * dorazila první a starší přehrávka by ji přepsala zpátky.
 *
 * "Tentýž řádek" se posuzuje podle mutationKeys: časy drží pořadí mezi
 * sebou, vyřazení ze startky taky, ale navzájem se nezdržují.
 */
export const processSyncQueue = async (executor) => {
  if (syncInProgress) return;
  // Skutečné spojení, ne jen navigator.onLine - ten na slabém signálu lže
  // a fronta by pálila pokusy o server, na který nic nedojde.
  if (!isOnline()) return;

  syncInProgress = true;
  try {
    const recovered = await recoverStaleProcessing();
    // Zápisy, které dřív (před rozlišením výpadku spojení) spálily pokusy
    // jen o nedostupný server, se vrací do fronty.
    const revived = await reviveNetworkFailures();
    const candidates = await getQueueCandidates();
    let changed = recovered + revived > 0;

    const blockedKeys = new Set();
    const keysOf = (row) => mutationKeys(row.method, row.endpoint, row.payload);
    const isBlocked = (row) => keysOf(row).some((key) => blockedKeys.has(key));
    const block = (row) => keysOf(row).forEach((key) => blockedKeys.add(key));

    for (const { row: listedRow, ready } of candidates) {
      // Čerstvě z databáze: přidání offline závodníka odeslané o kus dřív
      // v tomtéž průchodu mohlo položce přepsat dočasné id na serverové
      // (offlineEntries.remapTempEntry) - poslat i orazítkovat revizí se musí
      // už ta přepsaná podoba.
      const row = (await timekeeperDb.syncQueue.get(listedRow.id)) || listedRow;
      if (isBlocked(row) || isBlocked(listedRow)) continue;

      if (!ready) {
        block(row);
        continue;
      }

      if (row.retry_count >= MAX_RETRIES) {
        // Mutaci nikdy tiše nezahazujeme - zaparkuje se, aby ji UI ukázalo
        // a rozhodčí ji mohl poslat znovu z Centra synchronizace.
        await timekeeperDb.syncQueue.update(row.id, { status: 'dead', updated_at: nowIso() });
        block(row);
        changed = true;
        continue;
      }

      await timekeeperDb.syncQueue.update(row.id, { status: 'processing', updated_at: nowIso() });

      try {
        const response = await executor(row);
        await timekeeperDb.syncQueue.update(row.id, {
          status: 'done',
          updated_at: nowIso(),
          last_error: null,
          next_retry_at: null
        });
        await applySyncedRevisions(row, response);
        // Offline přidaný závodník je na serveru - dočasné id všude nahradit
        // serverovým, ať navazující zápisy (časy, vyřazení) jdou na něj.
        const tempId = createTempIdOf(row.method, row.endpoint, row.payload);
        if (tempId != null && response?.entry) {
          await remapTempEntry(tempId, response.entry);
        }
        await supersedeParkedOpsFor(row.method, row.endpoint, row.payload, row.created_at);
        changed = true;
      } catch (error) {
        const statusCode = extractStatusCode(error);

        // Vypršený token není chyba té mutace. Vrátíme řádek nedotčený a
        // skončíme - jinak celá fronta během pár minut spálí pokusy o tutéž
        // zeď a data jsou pryč.
        if (statusCode === 401 || statusCode === 403) {
          await timekeeperDb.syncQueue.update(row.id, {
            status: 'pending',
            updated_at: nowIso(),
            last_error: AUTH_EXPIRED_MESSAGE,
            next_retry_at: new Date(Date.now() + 60000).toISOString()
          });
          changed = true;
          break;
        }

        // Výpadek spojení (žádná odpověď serveru, vypršení) taky není chyba
        // té mutace: řádek zpátky do fronty beze změny počtu pokusů a konec
        // průchodu. Pokračuje se, až zkouška spojení server zase zastihne -
        // jinak by se ze slabého signálu stala „chyba synchronizace“ a po pár
        // minutách zaparkované mrtvé zápisy.
        if (statusCode == null && isNetworkError(error)) {
          await timekeeperDb.syncQueue.update(row.id, {
            status: 'pending',
            updated_at: nowIso(),
            next_retry_at: null
          });
          markUnreachable();
          changed = true;
          break;
        }

        if (CONFLICT_STATUSES.has(statusCode)) {
          await saveConflict(row, error, statusCode);
          await timekeeperDb.syncQueue.update(row.id, {
            status: 'conflict',
            updated_at: nowIso(),
            last_error: error?.message || 'Conflict detected',
            next_retry_at: null
          });
          block(row);
          changed = true;
          continue;
        }

        const retryCount = (row.retry_count || 0) + 1;
        await timekeeperDb.syncQueue.update(row.id, {
          status: retryCount >= MAX_RETRIES ? 'dead' : 'failed',
          updated_at: nowIso(),
          retry_count: retryCount,
          last_error: error?.message || 'Sync failed',
          next_retry_at: new Date(Date.now() + calculateBackoffMs(retryCount)).toISOString()
        });
        block(row);
        changed = true;
      }
    }

    if (changed) notifyQueueChanged();
  } finally {
    syncInProgress = false;
  }
};

/**
 * Dvě karty časoměřiče nad jednou IndexedDB by každá přehrála tutéž mutaci.
 * Druhá přehrávka narazí na už zvýšenou revizi a spadne do konfliktů, které
 * chtějí ruční řešení, přestože hodnota zapsaná je. Krátká zápůjčka
 * v localStorage nechá synchronizovat právě jednu kartu.
 */
const claimSyncLeadership = () => {
  if (typeof localStorage === 'undefined') return true;
  try {
    const raw = localStorage.getItem(LEADER_LEASE_KEY);
    const lease = raw ? JSON.parse(raw) : null;
    const fresh = lease && Date.now() - Number(lease.ts) < LEADER_LEASE_TTL_MS;

    if (fresh && lease.tabId !== tabId) return false;

    localStorage.setItem(LEADER_LEASE_KEY, JSON.stringify({ tabId, ts: Date.now() }));
    return true;
  } catch {
    // Anonymní režim / plná kvóta nesmí zastavit synchronizaci za závodu.
    return true;
  }
};

/**
 * Spustí synchronizaci na pozadí.
 * @returns {function} úklid, který zastaví časovač a odebere posluchače
 */
export const startSyncLoop = (executor) => {
  if (syncLoopStarted || typeof window === 'undefined') return () => {};
  syncLoopStarted = true;

  const trySync = () => {
    if (!claimSyncLeadership()) return;
    processSyncQueue(executor);
  };

  const onVisibility = () => {
    if (!document.hidden) trySync();
  };

  // Návrat spojení: událost prohlížeče i zkouška spojení, která server
  // znovu zastihla (connectivity.js).
  const stopBackOnline = onBackOnline(trySync);
  window.addEventListener('focus', trySync);
  document.addEventListener('visibilitychange', onVisibility);

  const intervalId = window.setInterval(trySync, SYNC_INTERVAL_MS);
  trySync();

  return () => {
    stopBackOnline();
    window.removeEventListener('focus', trySync);
    document.removeEventListener('visibilitychange', onVisibility);
    window.clearInterval(intervalId);
    syncLoopStarted = false;
  };
};
