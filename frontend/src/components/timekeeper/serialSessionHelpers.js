import { serialPortSignature } from '../../utils/serial.js';

// Konstanty a čisté pomocné funkce sériové relace.
//
// Vytaženo ze SerialSessionProvider (1260 řádků): tohle je obyčejná práce
// s localStorage a časovými limity, kterou jde otestovat bez hardwaru
// a bez vykreslení celého kontextu.

export const BRIDGE_DEDUP_MS = 1500;
export const TARGET_ROUND_KEY = 'timekeeper_bridge_target_round';
/** Remembers which of several granted ports was last used, so a reload can pick it. */
export const LAST_PORT_KEY = 'timekeeper_serial_last_port';

/**
 * Only one tab may hold the port - Web Serial is exclusive, and two tabs racing
 * for it means whichever reloads last wins and the other shows a bare "Chyba:".
 * Same lease pattern as the sync leader in timekeeperOffline.js.
 */
export const SERIAL_OWNER_KEY = 'timekeeper_serial_owner';
export const OWNER_TTL_MS = 9000;
export const OWNER_HEARTBEAT_MS = 3000;

/** A Dexie write that has not finished by then is treated as failed and buffered. */
export const PERSIST_TIMEOUT_MS = 5000;
/** In-memory safety net for events IndexedDB refused; retried until it recovers. */
export const FALLBACK_MAX = 1000;
export const FALLBACK_RETRY_MS = 8000;
/** Bounded automatic reconnect after a hotplug; beyond that the operator decides. */
export const RECONNECT_DELAYS_MS = [400, 1200, 3000];
/**
 * Every teardown hop (reader.cancel, pipe drain, port.close) is bounded.
 *
 * On an abruptly unplugged adapter Chrome routinely leaves those pending for
 * good; an unbounded teardown pinned teardownRef forever and wedged connect,
 * disconnect AND reconnect - the časomíra was dead until the tablet was
 * reloaded. Nothing here may wait on the hardware without a deadline.
 */
export const TEARDOWN_TIMEOUT_MS = 2500;
/** How long a teardown waits for an in-flight connect to notice it went stale. */
export const CONNECT_SETTLE_TIMEOUT_MS = 2500;
/**
 * What runTeardown itself can take in the worst case: the connect settle plus
 * its three bounded hardware hops. Everything that waits on a teardown waits at
 * least this long. Half of it (the old value) meant a waiter gave up while the
 * close was still draining, reopened the port, and the teardown then closed the
 * brand-new reader's port - reported as a plain expected "Odpojeno", with no
 * error, no retry and no way back but a reload.
 */
export const TEARDOWN_WAIT_MS = CONNECT_SETTLE_TIMEOUT_MS + TEARDOWN_TIMEOUT_MS * 3;
/**
 * port.open() on a half-dead adapter can stay pending for the life of the page.
 * It was the ONLY hardware hop here without a deadline, and the in-flight-connect
 * dedup then handed that same never-settling promise to every later connect,
 * autoConnect and "Obnovit připojení" - the časomíra was gone until the tablet
 * was reloaded. Nothing in this file may await hardware without a deadline.
 */
export const OPEN_TIMEOUT_MS = 5000;
/** Not every driver implements setSignals; a slow one must not hold the connect. */
export const SIGNALS_TIMEOUT_MS = 1500;
/** openSerialReader may itself open the port and drain a stale lock. */
export const READER_START_TIMEOUT_MS = 5000;
/**
 * Upper bound for a caller that dedups onto somebody else's in-flight connect.
 * Derived from the deadlines above, so it is always at least as long as a
 * healthy connect can legitimately take - and always finite.
 */
export const CONNECT_DEDUP_TIMEOUT_MS =
  TEARDOWN_WAIT_MS +
  OPEN_TIMEOUT_MS +
  SIGNALS_TIMEOUT_MS +
  READER_START_TIMEOUT_MS +
  TEARDOWN_TIMEOUT_MS;
/** Coalesce diagnostics counters so one device line is not one re-render. */
export const HEALTH_FLUSH_MS = 300;

export const PORT_HELD_TEXT = 'Časomíru obsluhuje jiná karta';

/** A port that never answered open() in time. Tagged so the catch can poison it. */
export const openTimeoutError = () => {
  const error = new Error('Časomíra neodpověděla na otevření portu');
  error.name = 'SerialOpenTimeoutError';
  return error;
};

export const randomTabId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const withTimeout = (promise, ms, messageText) =>
  new Promise((resolve, reject) => {
    const handle = setTimeout(() => reject(new Error(messageText)), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(handle);
        resolve(value);
      },
      (error) => {
        clearTimeout(handle);
        reject(error);
      },
    );
  });

/**
 * Await something that is allowed to fail or to hang, with a deadline.
 *
 * Returns true when it finished in time. Used for every hardware hop: the state
 * machine below is only safe because no `await` in it can outlive its deadline.
 */
export const settle = async (promise, ms) => {
  if (!promise) return true;
  try {
    await withTimeout(promise, ms, 'Časový limit vypršel');
    return true;
  } catch {
    return false;
  }
};

export const readTargetRound = () => {
  try {
    return localStorage.getItem(TARGET_ROUND_KEY) || '1';
  } catch {
    return '1';
  }
};

export const rememberPort = (port) => {
  const signature = serialPortSignature(port);
  if (!signature) return;
  try {
    localStorage.setItem(LAST_PORT_KEY, signature);
  } catch {
    // private mode / quota - not worth failing a connection over
  }
};

export const readOwnerLease = () => {
  try {
    const raw = localStorage.getItem(SERIAL_OWNER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const ownerLeaseIsFresh = (lease) =>
  Boolean(lease?.ts) && Date.now() - Number(lease.ts) < OWNER_TTL_MS;

/**
 * Which granted port may be opened without asking.
 *
 * One granted port -> that one. Several -> only when exactly one matches the
 * port the operator connected last; otherwise return null and let them pick,
 * because opening the wrong adapter looks exactly like a dead časomíra.
 */
export const pickAutoPort = (ports) => {
  if (!Array.isArray(ports) || ports.length === 0) return null;
  if (ports.length === 1) return ports[0];

  let remembered = null;
  try {
    remembered = localStorage.getItem(LAST_PORT_KEY);
  } catch {
    remembered = null;
  }
  if (!remembered) return null;

  const matches = ports.filter((port) => serialPortSignature(port) === remembered);
  return matches.length === 1 ? matches[0] : null;
};

export const EMPTY_HEALTH = {
  unparsedStreak: 0,
  unparsedTotal: 0,
  lastUnparsedLine: null,
  persistFailures: 0,
  lastPersistError: null,
  bufferedEvents: 0,
};
