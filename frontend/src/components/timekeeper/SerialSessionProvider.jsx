// One serial session for the whole timekeeper section.
//
// The port used to be owned by whichever screen happened to be mounted, and it
// was closed on unmount - so switching Časy -> Listina -> Časy dropped the
// časomíra mid-race, and a page reload left it disconnected even though the
// browser had already granted permission to that port. The session lives above
// <Routes> now: it survives navigation, reconnects itself where it is allowed
// to, and writes every line straight into the durable inbox so an event is
// never lost just because the timing screen was not on screen.
//
// Three things this file is responsible for and must not get wrong:
//
//  1. It NEVER attributes an event to a race. The device feed is global and the
//     selected-race key is written by five different screens; reading it here
//     used to file measured times into buckets no screen could display. Rows
//     land unassigned and the timing screen stamps the race on confirmation.
//  2. A line that cannot be parsed is still stored. A silent green "Připojeno"
//     with an empty inbox all morning is the worst failure this module has.
//  3. A failed IndexedDB write is never swallowed. It is counted, buffered in
//     memory and retried, and the counter is rendered by both timing screens.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { appendInboxEvent, buildOpKey } from '../../offline/bridgeInbox.js';
import {
  BRIDGE_DEDUP_MS,
  CONNECT_DEDUP_TIMEOUT_MS,
  CONNECT_SETTLE_TIMEOUT_MS,
  EMPTY_HEALTH,
  FALLBACK_MAX,
  FALLBACK_RETRY_MS,
  HEALTH_FLUSH_MS,
  openTimeoutError,
  OPEN_TIMEOUT_MS,
  OWNER_HEARTBEAT_MS,
  OWNER_TTL_MS,
  ownerLeaseIsFresh,
  PERSIST_TIMEOUT_MS,
  pickAutoPort,
  PORT_HELD_TEXT,
  randomTabId,
  READER_START_TIMEOUT_MS,
  readOwnerLease,
  readTargetRound,
  RECONNECT_DELAYS_MS,
  rememberPort,
  SERIAL_OWNER_KEY,
  settle,
  SIGNALS_TIMEOUT_MS,
  TEARDOWN_TIMEOUT_MS,
  TEARDOWN_WAIT_MS,
  withTimeout,
} from './serialSessionHelpers.js';
import { DB_STATE_EVENT, DB_STATE_TEXT, getDbState } from '../../offline/db.js';
import {
  BAUD_LOCK_KEY,
  DETECTION_WINDOW_MS,
  detectionCandidates,
  isCleanDeviceLine,
  runBaudDetection,
} from './baudDetection.js';
import {
  SERIAL_BAUD_KEY,
  canUseWebSerial,
  closeSerialPortSafely,
  hasWebSerial,
  isLineSettingsError,
  openSerialReader,
  parseIncomingTime,
  parseTimingDeviceLine,
  releaseLockedPortReader,
  serialPortSignature,
} from '../../utils/serial.js';

/** Two impulses this close together for the same bib+time are one impulse. */
/**
 * The unmount teardown of the PREVIOUS provider instance, held in module scope.
 *
 * It has to live outside the component: every guard this file serialises on
 * (teardownRef, connectGenRef, unmountedRef) is a ref of the instance that is
 * dying, so a freshly mounted provider is not held behind it at all - while the
 * two things that ARE shared between instances, the activePortReaders map in
 * utils/serial.js and the SerialPort object navigator.serial.getPorts() hands
 * back for the same device, are exactly what that teardown operates on. React
 * 18 StrictMode's mount/unmount/mount, or leaving /timekeeper and coming
 * straight back on a sluggish adapter, otherwise let the old instance's
 * releaseLockedPortReader cancel the NEW instance's live reader and close the
 * port under it. connect() waits behind this, bounded like everything else here.
 */
let pendingUnmountTeardown = null;

const SerialSessionContext = createContext(null);

export function SerialSessionProvider({ children }) {
  const [supported] = useState(() => hasWebSerial());
  const [canUse] = useState(() => canUseWebSerial());
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Odpojeno');
  const [port, setPort] = useState(null);
  const [knownPorts, setKnownPorts] = useState([]);
  const [heldByOtherTab, setHeldByOtherTab] = useState(false);
  const [health, setHealth] = useState(EMPTY_HEALTH);
  const [dbState, setDbState] = useState(() => getDbState());
  const [baud, setBaudState] = useState(() => {
    try {
      return localStorage.getItem(SERIAL_BAUD_KEY) || '9600';
    } catch {
      return '9600';
    }
  });
  /** Rychlost, na které už přišel platný řádek (ověřená); null = zatím žádná. */
  const [lockedBaud, setLockedBaud] = useState(() => {
    try {
      return localStorage.getItem(BAUD_LOCK_KEY);
    } catch {
      return null;
    }
  });
  /** Chyby přenosu na neověřené rychlosti - obrazovka nabídne "Zjistit rychlost". */
  const [baudHint, setBaudHint] = useState(false);
  /** Běžící hledání rychlosti: { baud, index, total } pro obrazovku, jinak null. */
  const [detection, setDetection] = useState(null);

  const readerRef = useRef(null);
  const portRef = useRef(null);
  const baudRef = useRef(baud);
  const lockedBaudRef = useRef(lockedBaud);
  const baudHintRef = useRef(false);
  /** Chyby přenosu za sebou bez jediného platného řádku. */
  const lineErrorStreakRef = useRef(0);
  /**
   * Běžící hledání rychlosti. Dokud trvá, řídí připojení ono: automatické
   * obnovování spojení stojí a nečitelné řádky nejdou do inboxu.
   */
  const detectRef = useRef(null);
  const connectingRef = useRef(false);
  /** Set while a close is draining; connect() awaits it instead of racing it. */
  const teardownRef = useRef(null);
  /**
   * The connect currently in flight. Two things depend on it: a second connect
   * returns ITS outcome instead of a fabricated `true`, and a teardown awaits it
   * (bounded) before snapshotting the reader.
   */
  const connectPromiseRef = useRef(null);
  /**
   * Bumped by every teardown/disconnect/unmount. connect() re-reads it after
   * each await and destroys the reader it just created if the number moved -
   * otherwise a cable knocked mid-connect orphans a live reader on a locked
   * readable that nothing can ever cancel, and the port dies until a reload.
   */
  const connectGenRef = useRef(0);
  /** >0 while a teardown drains, so the reader's onClose knows the exit was expected. */
  const teardownActiveRef = useRef(0);
  /** Ports whose teardown never let go; the next attempt takes a fresh object. */
  const poisonedPortsRef = useRef(new WeakSet());
  const manualDisconnectRef = useRef(false);
  const dedupRef = useRef(new Map());
  const lineListenersRef = useRef(new Set());
  const tabIdRef = useRef(randomTabId());
  const unmountedRef = useRef(false);
  const heldByOtherTabRef = useRef(false);

  const healthRef = useRef({ ...EMPTY_HEALTH });
  const healthTimerRef = useRef(null);
  const fallbackRef = useRef([]);
  const flushingRef = useRef(false);

  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const autoConnectRef = useRef(null);
  /** Bumped to cancel a running reconnect() retry loop (navigation, unmount, disconnect). */
  const reconnectRunRef = useRef(0);
  /** Resolver of the backoff currently being waited on, so it can be cut short. */
  const reconnectWaiterRef = useRef(null);

  /**
   * MUST be the first effect in this component.
   *
   * `unmountedRef` was only ever set to true. React 18 StrictMode mounts the
   * provider, runs the cleanups and re-runs the effects on the SAME fiber in
   * development, so the ref survived as `true` and every guard built on it
   * (stale(), scheduleReconnect, scheduleHealthFlush, reconnect's cancelled())
   * stayed permanently closed: clicking Připojit was a silent no-op and the
   * whole timing-device path could not be exercised in dev at all - which is
   * how the connect/teardown races above stayed invisible until race day.
   */
  useEffect(() => {
    unmountedRef.current = false;
    return () => { unmountedRef.current = true; };
  }, []);

  useEffect(() => {
    baudRef.current = baud;
    try {
      localStorage.setItem(SERIAL_BAUD_KEY, baud);
    } catch {
      // ignore
    }
  }, [baud]);

  useEffect(() => {
    heldByOtherTabRef.current = heldByOtherTab;
  }, [heldByOtherTab]);

  const setBaud = useCallback((value) => {
    setBaudState(String(value));
    // Ručně zvolená rychlost začíná s čistým štítem.
    lineErrorStreakRef.current = 0;
    baudHintRef.current = false;
    setBaudHint(false);
  }, []);

  /** Platný řádek z časomíry: rychlost je ověřená a chyby na ní jsou už jen šum. */
  const markBaudVerified = useCallback(() => {
    lineErrorStreakRef.current = 0;
    const current = String(baudRef.current);
    if (lockedBaudRef.current !== current) {
      lockedBaudRef.current = current;
      try {
        localStorage.setItem(BAUD_LOCK_KEY, current);
      } catch {
        // ignore
      }
      setLockedBaud(current);
    }
    if (baudHintRef.current) {
      baudHintRef.current = false;
      setBaudHint(false);
    }
  }, []);

  /** Raw-line feed for the diagnostics screen; returns an unsubscribe. */
  const subscribeLines = useCallback((listener) => {
    lineListenersRef.current.add(listener);
    return () => {
      lineListenersRef.current.delete(listener);
    };
  }, []);

  // --- database availability ------------------------------------------------

  useEffect(() => {
    const onDbState = () => setDbState(getDbState());
    window.addEventListener(DB_STATE_EVENT, onDbState);
    onDbState();
    return () => window.removeEventListener(DB_STATE_EVENT, onDbState);
  }, []);

  // --- diagnostics counters -------------------------------------------------

  const scheduleHealthFlush = useCallback(() => {
    if (healthTimerRef.current || unmountedRef.current) return;
    healthTimerRef.current = window.setTimeout(() => {
      healthTimerRef.current = null;
      if (!unmountedRef.current) setHealth({ ...healthRef.current });
    }, HEALTH_FLUSH_MS);
  }, []);

  // --- durable ingest -------------------------------------------------------

  /**
   * Write one event to the inbox.
   *
   * On failure the event is kept in memory and retried - and, crucially, the
   * failure is counted so the UI can say "N událostí se nepodařilo uložit"
   * instead of showing a green badge over an empty inbox. The timeout matters
   * too: the read loop awaits this call, so a Dexie open blocked by a stale tab
   * would otherwise stall the reader as well as lose the row.
   */
  const persistEvent = useCallback(async (event) => {
    try {
      await withTimeout(
        appendInboxEvent(event),
        PERSIST_TIMEOUT_MS,
        'Zápis do lokální databáze trvá příliš dlouho'
      );
      // Deliberately no state update on the happy path: this runs once per
      // impulse and re-rendering every consumer of the session context here
      // would undo the memoisation the timing table depends on.
      return true;
    } catch (err) {
      const buffer = fallbackRef.current;
      if (buffer.length < FALLBACK_MAX) buffer.push(event);
      healthRef.current.persistFailures += 1;
      healthRef.current.lastPersistError = err?.message || String(err);
      healthRef.current.bufferedEvents = buffer.length;
      scheduleHealthFlush();
      return false;
    }
  }, [scheduleHealthFlush]);

  /** Re-try everything IndexedDB refused earlier. op_key makes this idempotent. */
  const flushFallbackBuffer = useCallback(async () => {
    const buffer = fallbackRef.current;
    if (buffer.length === 0 || flushingRef.current) return;
    flushingRef.current = true;
    try {
      while (buffer.length > 0) {
        try {
          await withTimeout(
            appendInboxEvent(buffer[0]),
            PERSIST_TIMEOUT_MS,
            'Zápis do lokální databáze trvá příliš dlouho'
          );
          buffer.shift();
        } catch {
          break;
        }
      }
      healthRef.current.bufferedEvents = buffer.length;
      scheduleHealthFlush();
    } finally {
      flushingRef.current = false;
    }
  }, [scheduleHealthFlush]);

  useEffect(() => {
    const id = window.setInterval(() => { flushFallbackBuffer(); }, FALLBACK_RETRY_MS);
    return () => window.clearInterval(id);
  }, [flushFallbackBuffer]);

  /** Bounded dedup window; pruned on write so it cannot grow for the whole day. */
  const isRecentDuplicate = useCallback((key) => {
    const map = dedupRef.current;
    const now = Date.now();
    const lastSeen = map.get(key) || 0;
    const duplicate = (now - lastSeen) < BRIDGE_DEDUP_MS;
    if (!duplicate) {
      map.set(key, now);
      if (map.size > 64) {
        map.forEach((ts, mapKey) => {
          if ((now - ts) >= BRIDGE_DEDUP_MS) map.delete(mapKey);
        });
      }
    }
    return duplicate;
  }, []);

  // line -> parse -> validate -> persist. Everything that does not need the
  // start list happens here; matching a bib to an entry is the timing screen's
  // job, so rows land with candidateEntryIds === null and get enriched there.
  const handleLine = useCallback(async (line) => {
    lineListenersRef.current.forEach((listener) => {
      try {
        listener(line);
      } catch {
        // a broken listener must not stall the read loop
      }
    });

    const raw = String(line ?? '').trim();
    if (!raw) return;

    // Hledání rychlosti: první čitelný řádek ho ukončí. Nečitelné řádky
    // z cizí rychlosti do inboxu nepatří - zaplevelily by ho nesmysly.
    const detecting = detectRef.current;
    if (detecting) {
      if (isCleanDeviceLine(raw)) detecting.listener?.clean();
      if (!parseTimingDeviceLine(raw)) return;
    }

    const store = (event) => persistEvent({ ...event, op_key: buildOpKey(event) });

    const parsed = parseTimingDeviceLine(raw);

    if (!parsed) {
      // The nightmare case: a device configured with a slightly different
      // printout used to be dropped here with no trace at all. Keep it, count
      // it, and let the UI shout once a run of them piles up.
      healthRef.current.unparsedStreak += 1;
      healthRef.current.unparsedTotal += 1;
      healthRef.current.lastUnparsedLine = raw;
      scheduleHealthFlush();
      if (!isRecentDuplicate(`RAW|${raw}`)) {
        await store({
          raw,
          type: 'UNKNOWN',
          bib: null,
          time: null,
          seq: null,
          targetRound: readTargetRound(),
          status: 'warning',
          level: 'warning',
          reason: 'unparsed',
        });
      }
      return;
    }

    if (healthRef.current.unparsedStreak !== 0) {
      healthRef.current.unparsedStreak = 0;
      scheduleHealthFlush();
    }
    markBaudVerified();

    const base = {
      raw: parsed.raw || raw,
      seq: parsed.seq ?? null,
      targetRound: readTargetRound(),
    };
    const kind = String(parsed.type || '').toUpperCase();
    const bib = Number(parsed.bib ?? parsed.number ?? parsed.actual_number);

    // Bib 0 is not a bib. `Number(null) === 0`, so an entry whose
    // race_number_actual was never assigned has an effective bib of 0 and would
    // match a stray "...0..." line - the operator would see a plausible racer
    // and write a measured time onto somebody who never crossed the line. The
    // impulse is kept (with its raw line and its time) but stays unconfirmable.
    if (!Number.isFinite(bib) || bib <= 0) {
      await store({
        ...base,
        type: kind || 'UNKNOWN',
        bib: null,
        time: parsed.time ?? null,
        status: 'warning',
        level: 'warning',
        reason: 'missing_bib',
      });
      return;
    }

    if (isRecentDuplicate(`${kind}|${bib}|${parsed.time ?? ''}`)) {
      await store({
        ...base, type: kind, bib, time: parsed.time ?? null, status: 'warning', level: 'warning', reason: 'duplicate_ignored',
      });
      return;
    }

    if (kind === 'TIME') {
      if (parseIncomingTime(parsed.time) == null) {
        await store({
          ...base, type: kind, bib, time: parsed.time ?? null, status: 'warning', level: 'warning', reason: 'invalid_time',
        });
        return;
      }
    } else if (kind !== 'DNS' && kind !== 'DNF' && kind !== 'DSQ') {
      await store({
        ...base, type: kind || 'UNKNOWN', bib, status: 'warning', level: 'warning', reason: 'unsupported_type',
      });
      return;
    }

    await store({
      ...base,
      type: kind,
      bib,
      time: parsed.time ?? null,
      status: 'pending',
      level: 'info',
      candidateEntryIds: null,
      selectedEntryId: null,
      reason: null,
    });
  }, [persistEvent, isRecentDuplicate, scheduleHealthFlush, markBaudVerified]);

  // --- port ownership -------------------------------------------------------

  const claimOwnership = useCallback(({ force = false } = {}) => {
    if (typeof localStorage === 'undefined') return true;
    try {
      const lease = readOwnerLease();
      if (!force && ownerLeaseIsFresh(lease) && lease.tabId !== tabIdRef.current) return false;
      localStorage.setItem(SERIAL_OWNER_KEY, JSON.stringify({ tabId: tabIdRef.current, ts: Date.now() }));
      return true;
    } catch {
      // Private mode / quota must not stop race-day timing.
      return true;
    }
  }, []);

  const releaseOwnership = useCallback(() => {
    try {
      const lease = readOwnerLease();
      if (lease?.tabId === tabIdRef.current) localStorage.removeItem(SERIAL_OWNER_KEY);
    } catch {
      // ignore
    }
  }, []);

  // --- connection lifecycle -------------------------------------------------

  const refreshPorts = useCallback(async () => {
    if (!supported) return [];
    try {
      const list = await navigator.serial.getPorts();
      setKnownPorts(list);
      return list;
    } catch {
      // Permission-Policy blocked or the user revoked access: nothing granted.
      setKnownPorts([]);
      return [];
    }
  }, [supported]);

  const scheduleReconnect = useCallback(() => {
    if (manualDisconnectRef.current || unmountedRef.current || detectRef.current) return;
    const attempt = reconnectAttemptRef.current;
    if (attempt >= RECONNECT_DELAYS_MS.length) {
      setStatus('Zařízení se nepodařilo obnovit – klikněte na „Obnovit připojení“');
      return;
    }
    reconnectAttemptRef.current = attempt + 1;
    if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      autoConnectRef.current?.();
    }, RECONNECT_DELAYS_MS[attempt]);
  }, []);

  /** Backoff that can be cut short, so a retry loop is never uncancellable. */
  const waitBeforeRetry = useCallback((ms) => new Promise((resolve) => {
    const handle = window.setTimeout(() => {
      reconnectWaiterRef.current = null;
      resolve();
    }, ms);
    reconnectWaiterRef.current = () => {
      window.clearTimeout(handle);
      reconnectWaiterRef.current = null;
      resolve();
    };
  }), []);

  /** Invalidate any running reconnect() loop and wake it immediately. */
  const abortReconnectLoop = useCallback(() => {
    reconnectRunRef.current += 1;
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    const waiter = reconnectWaiterRef.current;
    if (waiter) waiter();
  }, []);

  /**
   * Cancel -> drain the pipe -> release the lock -> close the port, all awaited
   * and all bounded.
   *
   * Skipping any of it leaves the port locked and unreopenable, which is exactly
   * how a knocked USB cable used to kill the časomíra until a page reload. The
   * promise is published on teardownRef so connect() can wait behind it instead
   * of reopening a port whose close has not settled.
   *
   * Two guarantees this owes the rest of the file:
   *  - it ALWAYS settles. Every hop has a deadline, the published promise never
   *    rejects, and teardownRef is cleared in a finally. A hung reader.cancel()
   *    on an unplugged adapter can no longer wedge connect/disconnect/reconnect.
   *  - it invalidates an in-flight connect BEFORE snapshotting the reader, so a
   *    reader created a moment later is torn down by connect() itself instead of
   *    being orphaned on a locked readable.
   */
  const runTeardown = useCallback(async ({ closePort = true } = {}) => {
    // Bumped on EVERY entry, the re-entrant one included: "tear down" is an
    // intent, and a connect that is merely waiting behind an older teardown must
    // still be invalidated by it. Without this, Odpojit clicked while a connect
    // waited on a previous close ended with the device connected again.
    connectGenRef.current += 1;

    if (teardownRef.current) {
      await settle(teardownRef.current, TEARDOWN_WAIT_MS);
      return;
    }

    // Order matters: bump first, snapshot second, both synchronously. Either
    // connect() has already published its reader (we see it here) or it has not
    // yet re-checked the generation (it will, and will clean up after itself).
    const inflightConnect = connectPromiseRef.current;
    const reader = readerRef.current;
    const target = portRef.current;
    readerRef.current = null;

    if (!reader && !target && !inflightConnect) return;

    teardownActiveRef.current += 1;
    const promise = (async () => {
      try {
        // Bounded on purpose: a connect stuck in port.open() on a half-dead
        // adapter must not pin the teardown. The generation bump above makes it
        // release whatever it built whenever it does come back.
        await settle(inflightConnect, CONNECT_SETTLE_TIMEOUT_MS);

        if (reader) {
          await settle(reader.close({ closePort: false }), TEARDOWN_TIMEOUT_MS);
        }
        if (target) {
          // close() rejects while the readable is locked, so break the lock
          // first - otherwise the port stays claimed for the life of the page.
          await settle(releaseLockedPortReader(target, TEARDOWN_TIMEOUT_MS), TEARDOWN_TIMEOUT_MS);
          if (closePort) {
            await settle(closeSerialPortSafely(target), TEARDOWN_TIMEOUT_MS);
          }
          if (target.readable && target.readable.locked) {
            // The drain never let go. This port object is unusable; the next
            // attempt must take a fresh one from navigator.serial.getPorts().
            poisonedPortsRef.current.add(target);
          }
        }
      } finally {
        teardownActiveRef.current -= 1;
        // Cleared HERE, inside the promise's own body, so it is already null by
        // the time that promise resolves. A waiter (connect) can then treat
        // "settled" and "teardownRef is clear" as the same fact instead of
        // reasoning about microtask ordering - it has to refuse to open the
        // port while a teardown is still draining, and a false positive there
        // costs a whole reconnect cycle mid-race.
        if (teardownRef.current === promise) teardownRef.current = null;
      }
    })();

    teardownRef.current = promise;
    try {
      await promise;
    } finally {
      if (teardownRef.current === promise) teardownRef.current = null;
    }
  }, []);

  /**
   * Swap a port object whose teardown never let go for a fresh one.
   * Returns the port to use (possibly the same object when nothing better
   * exists - trying is still better than refusing to connect at all).
   */
  const refreshPoisonedPort = useCallback(async (target) => {
    if (!target || !poisonedPortsRef.current.has(target)) return target;

    const signature = serialPortSignature(target);
    if (signature == null) {
      // The OS reports no USB ids for this port (Bluetooth SPP, a platform COM
      // port). There is then NO way to tell a replacement for this device from
      // an unrelated granted port, and the old predicate happily took the first
      // other port it found: the tablet showed a green "Připojeno" on somebody
      // else's adapter, an inbox that never received an impulse, and the wrong
      // choice was written to LAST_PORT_KEY so it survived every reload.
      return target;
    }

    const list = await refreshPorts();
    const replacement = list.find((item) => item !== target && serialPortSignature(item) === signature);
    if (!replacement) return target;
    poisonedPortsRef.current.delete(target);
    portRef.current = replacement;
    setPort(replacement);
    return replacement;
  }, [refreshPorts]);

  const connect = useCallback(async (targetPort, { takeOwnership = true } = {}) => {
    if (!supported) {
      setStatus('Web Serial není podporováno');
      return false;
    }
    if (!canUse) {
      setStatus('Vyžaduje HTTPS nebo localhost');
      return false;
    }

    // A connect is already running. Hand back ITS outcome - reconnect() used to
    // read the fabricated `true` as proof and stop retrying over a dead device.
    //
    // Bounded, and that bound is the whole point: this used to be a bare await
    // on a promise that could never settle, so ONE hung port.open() spread to
    // every later connect, to autoConnect, to the hotplug handler and to
    // "Obnovit připojení" - all of them pinned for the life of the page.
    // Giving up here is safe: the connect it waited on is itself bounded now,
    // and the caller (reconnect/autoConnect) simply retries.
    if (connectPromiseRef.current) {
      try {
        return await withTimeout(
          connectPromiseRef.current,
          CONNECT_DEDUP_TIMEOUT_MS,
          'Připojení k časomíře trvá příliš dlouho'
        );
      } catch {
        return false;
      }
    }

    // EVERYTHING from here on runs inside the published promise, and the promise
    // is published before control can leave connect().
    //
    // The dedup token used to be assigned only after the teardown wait, with a
    // real suspension in between: while a close was draining (up to
    // TEARDOWN_WAIT_MS on a wedged adapter) a second caller read a null
    // connectPromiseRef, walked straight past the guard above and parked on the
    // same teardown promise. Both then woke with the SAME generation, both
    // passed stale(), and both opened the same port object - the loser's
    // late-cleanup path cancelled the winner's live reader, and every impulse
    // the LIP emitted during the reconnect that followed was lost with no inbox
    // row. An async body runs synchronously up to its first await, so `gen` is
    // still captured before a teardown entered later can move it, exactly as
    // before, and no other task can run between that capture and the assignment
    // of connectPromiseRef below.
    const promise = (async () => {
      // Captured BEFORE the waits below: a teardown started while we wait must
      // invalidate this call, or a disconnect during a connect ends up connected.
      const gen = connectGenRef.current;
      const stale = () => connectGenRef.current !== gen || unmountedRef.current;

      // A previous provider INSTANCE may still be closing this very port object
      // (StrictMode remount, or leaving /timekeeper and coming straight back).
      // Its refs cannot hold us back, so wait on the module-scope handle.
      if (pendingUnmountTeardown) {
        setStatus('Ukončuji předchozí připojení...');
        const finished = await settle(pendingUnmountTeardown, TEARDOWN_WAIT_MS);
        if (stale()) return false;
        if (!finished) {
          setStatus('Předchozí připojení se nepodařilo ukončit – klikněte na „Obnovit připojení“');
          return false;
        }
      }

      // Never race an in-flight close: Odpojit -> Připojit and unplug -> replug
      // both used to reopen a port that was still being torn down.
      if (teardownRef.current) {
        setStatus('Ukončuji předchozí připojení...');
        const closed = await settle(teardownRef.current, TEARDOWN_WAIT_MS);
        if (stale()) return false;
        // Waiting is not enough - the teardown has to have FINISHED. Opening the
        // port under a teardown that is still draining means the teardown closes
        // the new reader's port a couple of seconds later, and the reader's
        // onClose calls that death expected: status went to a grey "Odpojeno"
        // with no error and no retry while racers were still finishing.
        if (!closed || teardownRef.current) {
          setStatus('Předchozí připojení se nepodařilo ukončit – klikněte na „Obnovit připojení“');
          return false;
        }
      }

      if (readerRef.current) return true;

      let target = targetPort || portRef.current;
      target = await refreshPoisonedPort(target);
      if (!target) {
        setStatus('Nejprve vyberte port');
        return false;
      }
      if (stale()) return false;

      if (!claimOwnership({ force: takeOwnership })) {
        setHeldByOtherTab(true);
        setStatus(PORT_HELD_TEXT);
        return false;
      }
      setHeldByOtherTab(false);

      // Tracks the reader this call creates, so its onClose can tell "my reader
      // died" from "some other reader died" before it was ever published.
      const holder = { reader: null, closed: false };
      /**
       * Give up on `target`, without closing a port somebody else now owns.
       *
       * A connect that came back late (a slow open, a teardown that invalidated
       * it) must clean up after itself - but by then a NEWER connect may have
       * published a live reader on this very port object, and closing it would
       * kill the working session it just established.
       */
      const abandonPort = async () => {
        if (readerRef.current && portRef.current === target) return;
        await settle(closeSerialPortSafely(target), TEARDOWN_TIMEOUT_MS);
      };
      connectingRef.current = true;
      try {
        setStatus('Připojuji...');
        const baudRate = Number(baudRef.current) || 9600;
        if (!target.readable) {
          // Bounded: on a half-dead adapter Chrome leaves this pending forever.
          const opened = await settle(target.open({ baudRate }), OPEN_TIMEOUT_MS);
          if (!opened) throw openTimeoutError();
        }
        if (stale()) {
          await abandonPort();
          return false;
        }
        // Some USB-serial adapters keep the LIP silent until DTR/RTS are raised.
        // Not every driver implements setSignals, so neither a rejection nor a
        // timeout is fatal here.
        await settle(
          target.setSignals({ dataTerminalReady: true, requestToSend: true }),
          SIGNALS_TIMEOUT_MS
        );
        if (stale()) {
          await abandonPort();
          return false;
        }

        // Bounded too: openSerialReader may open the port itself and may wait
        // on a stale lock being drained.
        const reader = await withTimeout(openSerialReader(target, {
          baudRate,
          onLine: handleLine,
          onClose: (error) => {
            holder.closed = true;
            const wasPublished = holder.reader != null && readerRef.current === holder.reader;
            if (wasPublished) readerRef.current = null;
            setConnected(false);

            // Scoped to THIS reader's own lifecycle. Reading the global
            // teardownActiveRef instead meant a reader killed by somebody
            // ELSE's still-draining teardown was written off as an expected
            // close: no error, no retry, no scheduleReconnect, and a grey
            // "Odpojeno" badge for the rest of the race. connectGenRef is
            // bumped by every teardown, disconnect and unmount, so a change
            // since this connect started is the precise test for "something
            // asked for this reader to go away".
            const expected = connectGenRef.current !== gen
              || manualDisconnectRef.current
              || unmountedRef.current;
            if (expected) {
              setStatus('Odpojeno');
              return;
            }
            // Not published yet: connect() below is about to notice `closed`
            // and clean up. Doing it here too would double-close.
            if (!wasPublished) return;

            // Hledání rychlosti si připojení řídí samo: chyba přenosu na
            // zkoušené rychlosti znamená "tahle to není", ne "obnov spojení".
            if (detectRef.current) {
              detectRef.current.listener?.error(error);
              return;
            }

            // The read loop died with no OS-level 'disconnect' event - a driver
            // hiccup, a brown-out, a framing error on a cold cable. Nothing else
            // schedules a retry for this, and the port would stay open with a
            // null readable, so the next connect() would fail on open().
            if (isLineSettingsError(error)) {
              lineErrorStreakRef.current += 1;
              const verified = lockedBaudRef.current === String(baudRef.current);
              if (!verified) {
                baudHintRef.current = true;
                setBaudHint(true);
              }
              // Na neověřené rychlosti chyby za sebou neopraví žádné obnovení
              // spojení - jen by se dokola připojovalo. Rychlost se ale sama
              // nepřepíná (může to být šum), rozhodne obsluha.
              if (!verified && lineErrorStreakRef.current >= 3) {
                setStatus(`Časomíra nejspíš vysílá jinou rychlostí než ${baudRef.current} – klikněte na „Zjistit rychlost“`);
                window.setTimeout(() => { runTeardown({ closePort: true }); }, 0);
                return;
              }
              setStatus(verified
                ? `Chyba přenosu z časomíry (${error.name}) – zkouším obnovit; když se to opakuje, zkontrolujte kabel`
                : `Časomíra posílá data, kterým nerozumím – nejspíš je nastavená jiná rychlost než ${baudRef.current}. Zkouším obnovit…`);
            } else {
              setStatus('Spojení s časomírou se přerušilo – zkouším obnovit');
            }
            window.setTimeout(() => {
              if (unmountedRef.current || manualDisconnectRef.current) return;
              (async () => {
                await runTeardown({ closePort: true });
                if (!unmountedRef.current && !manualDisconnectRef.current) scheduleReconnect();
              })();
            }, 0);
          },
        }), READER_START_TIMEOUT_MS, 'Čtení z časomíry se nepodařilo spustit');
        holder.reader = reader;

        if (stale() || holder.closed) {
          // Nobody else has this reader, so nobody else can release it.
          await settle(reader.close({ closePort: false }), TEARDOWN_TIMEOUT_MS);
          // ...but any lock LEFT on the port after that close is somebody else's.
          // releaseLockedPortReader looks the handle up by port in a module-global
          // map, so when a newer connect has meanwhile published a live reader on
          // this same port object, calling it here cancels that working session.
          // Same guard abandonPort carries, for the same reason.
          if (!(readerRef.current && portRef.current === target)) {
            await settle(releaseLockedPortReader(target, TEARDOWN_TIMEOUT_MS), TEARDOWN_TIMEOUT_MS);
          }
          await abandonPort();
          if (!stale() && holder.closed) {
            setConnected(false);
            setStatus('Zařízení se odmlčelo hned po připojení – zkouším obnovit');
            scheduleReconnect();
          }
          return false;
        }

        readerRef.current = reader;
        portRef.current = target;
        manualDisconnectRef.current = false;
        reconnectAttemptRef.current = 0;
        rememberPort(target);
        setPort(target);
        setConnected(true);
        setStatus('Připojeno');
        return true;
      } catch (err) {
        setConnected(false);
        if (err?.name === 'SerialOpenTimeoutError') {
          // open() never answered. It may still resolve later and leave this
          // port object open behind our back, so it is unusable for us: the
          // next attempt must take a fresh one from navigator.serial.getPorts().
          poisonedPortsRef.current.add(target);
          setStatus('Časomíra neodpovídá – port se nepodařilo otevřít včas, zkuste přepojit kabel');
        } else if (err?.name === 'SerialPortBusyError') {
          // The lock survived a real cancel attempt: this port object is dead.
          poisonedPortsRef.current.add(target);
          setStatus('Port drží předchozí připojení – zkouším získat nový port');
        } else {
          setStatus(`Chyba: ${err?.message || 'nelze otevřít port'}`);
        }
        // Whatever half-open state we are in, get rid of it so the next attempt
        // (automatic or via "Obnovit připojení") starts from a genuinely closed
        // port. Closing `target` and not portRef: the failed port may not be the
        // one this session was using before - and never the port a newer
        // connect has meanwhile made live (see abandonPort).
        await abandonPort();
        // Do not sit on a lease we never used - the other tab would refuse to
        // open the device until the watchdog TTL expires, mid-race.
        if (!readerRef.current && connectGenRef.current === gen) releaseOwnership();
        return false;
      } finally {
        connectingRef.current = false;
      }
    })();

    connectPromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      if (connectPromiseRef.current === promise) connectPromiseRef.current = null;
    }
  }, [
    supported, canUse, handleLine, claimOwnership, releaseOwnership,
    refreshPoisonedPort, runTeardown, scheduleReconnect,
  ]);

  /**
   * Zastaví běžící hledání rychlosti. Tlačítko Zastavit se pak vrátí
   * k původní rychlosti; Odpojit a Obnovit připojení (resume: false) si
   * spojení řídí samy, takže se hledání znovu nepřipojuje.
   */
  const cancelDetection = useCallback(({ resume = true } = {}) => {
    const session = detectRef.current;
    if (!session) return;
    session.cancelled = true;
    session.resume = resume;
    // Odpojit / Obnovit připojení pokračují hned - na původní rychlosti.
    if (!resume && session.original) baudRef.current = session.original;
    session.listener?.cancel();
  }, []);

  const disconnect = useCallback(async () => {
    cancelDetection({ resume: false });
    manualDisconnectRef.current = true;
    reconnectAttemptRef.current = RECONNECT_DELAYS_MS.length;
    abortReconnectLoop();
    setConnected(false);
    setStatus('Odpojuji...');
    await runTeardown({ closePort: true });
    releaseOwnership();
    setStatus('Odpojeno');
  }, [runTeardown, releaseOwnership, abortReconnectLoop, cancelDetection]);

  /**
   * "Obnovit připojení": force-close whatever is left and open the port again.
   * The one control that recovers a hotplug the browser handled badly, without
   * reloading the tab mid-race.
   *
   * The loop carries a run token: navigating out of the section, disconnecting
   * or clicking the button again cancels it, so it can never open a port on a
   * provider that is already gone and claim the device for a dead session.
   */
  const reconnect = useCallback(async () => {
    cancelDetection({ resume: false });
    abortReconnectLoop();
    const run = reconnectRunRef.current;
    const cancelled = () => reconnectRunRef.current !== run || unmountedRef.current;

    manualDisconnectRef.current = false;
    reconnectAttemptRef.current = 0;
    setHeldByOtherTab(false);
    claimOwnership({ force: true });
    setStatus('Obnovuji připojení...');
    await runTeardown({ closePort: true });
    if (cancelled()) return false;

    for (let attempt = 0; attempt < RECONNECT_DELAYS_MS.length; attempt += 1) {
      if (attempt > 0) {
        await waitBeforeRetry(RECONNECT_DELAYS_MS[attempt]);
        if (cancelled()) return false;
      }
      const list = await refreshPorts();
      if (cancelled()) return false;
      const target = (portRef.current && list.includes(portRef.current))
        ? portRef.current
        : (pickAutoPort(list) || portRef.current);
      if (!target) {
        setStatus(list.length > 1 ? 'Vyberte port' : 'Žádný povolený port');
        return false;
      }
      const ok = await connect(target, { takeOwnership: true });
      if (cancelled()) return false;
      if (ok) return true;
      await runTeardown({ closePort: true });
      if (cancelled()) return false;
    }

    setStatus('Nepodařilo se obnovit připojení – zkuste jiný port nebo přepojit kabel');
    return false;
  }, [claimOwnership, runTeardown, refreshPorts, connect, waitBeforeRetry, abortReconnectLoop, cancelDetection]);

  /**
   * "Zjistit rychlost": projde rychlosti (baudDetection.js) a nechá tu, na
   * které přišel čitelný řádek. Obsluha mezitím posílá z časomíry časy nebo
   * ji vypne a zapne. Spouští se jen tlačítkem - rychlost se sama nepřepíná.
   *
   * Nic nenalezeno nebo zastaveno: vrátí se původní rychlost a připojí se
   * na ni, ať časomíra zůstane v provozu, jak byla.
   *
   * @returns {Promise<number|null>} nalezená rychlost
   */
  const detectBaud = useCallback(async () => {
    if (detectRef.current) return null;
    const original = String(baudRef.current);
    let target = portRef.current;
    if (!target) {
      target = pickAutoPort(await refreshPorts());
      if (target) {
        portRef.current = target;
        setPort(target);
      }
    }
    if (!target) {
      setStatus('Nejprve vyberte port');
      return null;
    }

    abortReconnectLoop();
    manualDisconnectRef.current = false;
    setHeldByOtherTab(false);
    const session = { cancelled: false, listener: null, original };
    detectRef.current = session;
    const cancelled = () => session.cancelled || unmountedRef.current;
    const prompt = (current) => (
      `Hledám rychlost: ${current.baud} (${current.index + 1}/${current.total}) – pošlete z časomíry čas, nebo ji vypněte a zapněte`
    );
    let progress = null;

    try {
      const found = await runBaudDetection({
        candidates: detectionCandidates(original),
        windowMs: DETECTION_WINDOW_MS,
        cancelled,
        onProgress: (current) => {
          progress = current;
          setDetection(current);
          setStatus(prompt(current));
        },
        open: async (candidate) => {
          await runTeardown({ closePort: true });
          if (cancelled()) return false;
          baudRef.current = String(candidate);
          const ok = await connect(target, { takeOwnership: true });
          // connect() hlásí "Připojeno" - během hledání platí výzva obsluze.
          if (ok && progress && !cancelled()) setStatus(prompt(progress));
          return ok;
        },
        listen: (ms) => new Promise((resolve) => {
          const finish = (outcome) => {
            window.clearTimeout(timer);
            session.listener = null;
            resolve(outcome);
          };
          const timer = window.setTimeout(() => finish('timeout'), ms);
          session.listener = {
            clean: () => finish('clean'),
            error: () => finish('error'),
            cancel: () => finish('cancelled'),
          };
        }),
      });

      if (found) {
        // Spojení na nalezené rychlosti už běží - jen ji uložit a ověřit.
        baudRef.current = String(found);
        setBaudState(String(found));
        markBaudVerified();
        setStatus(`Rychlost ${found} nalezena – časomíra připojena`);
        return found;
      }

      if (session.resume === false) {
        // Odpojit / Obnovit připojení: spojení teď řídí ony.
        baudRef.current = original;
        return null;
      }
      await runTeardown({ closePort: true });
      baudRef.current = original;
      detectRef.current = null;
      const ok = (unmountedRef.current || manualDisconnectRef.current)
        ? false
        : await connect(target, { takeOwnership: true });
      if (!unmountedRef.current) {
        setStatus(session.cancelled
          ? (ok ? `Hledání zastaveno – připojeno na ${original}` : 'Hledání zastaveno')
          : `Rychlost se nepodařilo zjistit – zkontrolujte kabel a zkuste to znovu (zůstává ${original})`);
      }
      return null;
    } finally {
      if (detectRef.current === session) detectRef.current = null;
      if (!unmountedRef.current) setDetection(null);
    }
  }, [abortReconnectLoop, connect, markBaudVerified, refreshPorts, runTeardown]);

  /** Only ever called from a click - requestPort() throws without a user gesture. */
  const requestPort = useCallback(async () => {
    if (!supported || !canUse) return null;
    try {
      const chosen = await navigator.serial.requestPort();
      portRef.current = chosen;
      manualDisconnectRef.current = false;
      setPort(chosen);
      setKnownPorts((prev) => [...prev.filter((item) => item !== chosen), chosen]);
      setStatus('Port vybrán');
      return chosen;
    } catch {
      setStatus('Výběr portu zrušen');
      return null;
    }
  }, [supported, canUse]);

  /** Pick one of the already-granted ports without opening it. */
  const selectPort = useCallback((chosen) => {
    portRef.current = chosen || null;
    setPort(chosen || null);
    if (chosen) {
      rememberPort(chosen);
      setStatus('Port vybrán');
    }
  }, []);

  useEffect(() => {
    if (!supported) {
      setStatus('Web Serial není podporováno');
      return undefined;
    }
    if (!canUse) {
      setStatus('Vyžaduje HTTPS nebo localhost');
      return undefined;
    }

    let cancelled = false;

    // getPorts() returns ports the user already granted; opening one of those
    // needs no user gesture, which is what makes silent reconnect legal.
    const autoConnect = async () => {
      const list = await refreshPorts();
      if (cancelled || readerRef.current || connectingRef.current || connectPromiseRef.current) return;
      if (detectRef.current) return;
      if (manualDisconnectRef.current) return;

      const lease = readOwnerLease();
      if (ownerLeaseIsFresh(lease) && lease.tabId !== tabIdRef.current) {
        // Another tab owns the device. Say so instead of a bare "Chyba:" - and
        // it does not matter for the data any more, because that tab writes to
        // the same durable inbox and this one refreshes cross-tab.
        setHeldByOtherTab(true);
        setStatus(PORT_HELD_TEXT);
        return;
      }
      setHeldByOtherTab(false);

      const target = pickAutoPort(list);
      if (!target) {
        if (list.length > 1) setStatus('Vyberte port');
        else if (list.length === 0) setStatus('Žádný povolený port');
        return;
      }
      portRef.current = target;
      setPort(target);
      const ok = await connect(target, { takeOwnership: false });
      if (!ok && !cancelled) scheduleReconnect();
    };

    autoConnectRef.current = autoConnect;
    autoConnect();

    const onSerialConnect = () => {
      reconnectAttemptRef.current = 0;
      autoConnect();
    };

    // Hotplug unplug. The teardown is awaited and always closes the port, and
    // only then may a reconnect run - connect() waits behind teardownRef.
    const onSerialDisconnect = async (event) => {
      refreshPorts();
      if (event?.target && portRef.current && event.target !== portRef.current) return;
      setConnected(false);
      await runTeardown({ closePort: true });
      if (cancelled) return;
      // After the teardown, because the reader's onClose sets 'Odpojeno' on its
      // way out and would otherwise overwrite this.
      setStatus('Zařízení odpojeno – zkouším obnovit');
      scheduleReconnect();
    };

    // Another tab took the device over (or gave it up).
    const onStorage = async (storageEvent) => {
      if (storageEvent.key !== SERIAL_OWNER_KEY) return;
      const lease = readOwnerLease();
      if (!lease || lease.tabId === tabIdRef.current) {
        setHeldByOtherTab(false);
        if (!readerRef.current && !manualDisconnectRef.current) {
          reconnectAttemptRef.current = 0;
          scheduleReconnect();
        }
        return;
      }
      if (!ownerLeaseIsFresh(lease)) return;
      setHeldByOtherTab(true);
      // A connect that is still in flight counts: it would otherwise finish and
      // claim a device the other tab has just taken. runTeardown invalidates it.
      if (readerRef.current || connectPromiseRef.current) {
        // Hand the port over cleanly, otherwise the taking tab cannot open it.
        setConnected(false);
        await runTeardown({ closePort: true });
        if (!cancelled) setStatus(PORT_HELD_TEXT);
      }
    };

    // A tab that crashed leaves its lease behind - no storage event ever fires,
    // so without this poll the surviving tab would stay "obsluhuje jiná karta"
    // for the rest of the race.
    const ownerWatchdog = window.setInterval(() => {
      if (cancelled || !heldByOtherTabRef.current) return;
      if (readerRef.current || connectingRef.current || connectPromiseRef.current) return;
      if (manualDisconnectRef.current) return;
      const lease = readOwnerLease();
      if (ownerLeaseIsFresh(lease) && lease.tabId !== tabIdRef.current) return;
      setHeldByOtherTab(false);
      reconnectAttemptRef.current = 0;
      autoConnect();
    }, OWNER_TTL_MS);

    navigator.serial.addEventListener('connect', onSerialConnect);
    navigator.serial.addEventListener('disconnect', onSerialDisconnect);
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;
      autoConnectRef.current = null;
      window.clearInterval(ownerWatchdog);
      navigator.serial.removeEventListener('connect', onSerialConnect);
      navigator.serial.removeEventListener('disconnect', onSerialDisconnect);
      window.removeEventListener('storage', onStorage);
    };
  }, [supported, canUse, connect, refreshPorts, runTeardown, scheduleReconnect]);

  // Renew the ownership lease while we actually hold the port.
  useEffect(() => {
    if (!connected) return undefined;
    const id = window.setInterval(() => { claimOwnership({ force: true }); }, OWNER_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [connected, claimOwnership]);

  // Only fires when the whole timekeeper section unmounts, not on navigation.
  useEffect(() => () => {
    unmountedRef.current = true;
    // Invalidate a connect and a reconnect loop that are still in flight: both
    // would otherwise open the port and store a reader in refs nobody will ever
    // tear down, keeping the device claimed by a dead session.
    connectGenRef.current += 1;
    reconnectRunRef.current += 1;
    const waiter = reconnectWaiterRef.current;
    if (waiter) waiter();
    if (healthTimerRef.current) window.clearTimeout(healthTimerRef.current);
    if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
    const reader = readerRef.current;
    const target = portRef.current;
    readerRef.current = null;
    portRef.current = null;
    // Published so the NEXT provider instance can wait behind it: this chain
    // acts on the module-global reader map and on the shared SerialPort object,
    // and a remount that races it has its brand-new reader cancelled from under
    // it. Every hop is bounded, so the handle always clears itself.
    const pending = (async () => {
      if (reader) await settle(reader.close({ closePort: false }), TEARDOWN_TIMEOUT_MS);
      await settle(releaseLockedPortReader(target, TEARDOWN_TIMEOUT_MS), TEARDOWN_TIMEOUT_MS);
      await settle(closeSerialPortSafely(target), TEARDOWN_TIMEOUT_MS);
    })().finally(() => {
      if (pendingUnmountTeardown === pending) pendingUnmountTeardown = null;
    });
    pendingUnmountTeardown = pending;
    try {
      const lease = readOwnerLease();
      if (lease?.tabId === tabIdRef.current) localStorage.removeItem(SERIAL_OWNER_KEY);
    } catch {
      // ignore
    }
  }, []);

  const dbStateText = dbState === 'ok' ? null : (DB_STATE_TEXT[dbState] || null);

  const value = useMemo(() => ({
    supported,
    canUse,
    connected,
    status,
    port,
    baud,
    setBaud,
    requestPort,
    selectPort,
    connect,
    disconnect,
    reconnect,
    knownPorts,
    refreshPorts,
    subscribeLines,
    heldByOtherTab,
    health,
    dbState,
    dbStateText,
    retryPersist: flushFallbackBuffer,
    lockedBaud,
    baudHint,
    detection,
    detectBaud,
    cancelDetection,
  }), [
    supported, canUse, connected, status, port, baud, setBaud, requestPort, selectPort,
    connect, disconnect, reconnect, knownPorts, refreshPorts, subscribeLines,
    heldByOtherTab, health, dbState, dbStateText, flushFallbackBuffer,
    lockedBaud, baudHint, detection, detectBaud, cancelDetection,
  ]);

  return (
    <SerialSessionContext.Provider value={value}>
      {children}
    </SerialSessionContext.Provider>
  );
}

export const useSerialSession = () => {
  const ctx = useContext(SerialSessionContext);
  if (!ctx) {
    throw new Error('useSerialSession musí být uvnitř <SerialSessionProvider>');
  }
  return ctx;
};

export default SerialSessionProvider;
