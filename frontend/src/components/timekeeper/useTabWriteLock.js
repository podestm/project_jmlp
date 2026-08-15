import { useEffect, useRef, useState } from 'react';

const TAB_LOCK_HEARTBEAT_MS = 3000;
const TAB_LOCK_STALE_MS = 9000;

/**
 * Právo zapisovat časy má vždy jen jedna karta.
 *
 * Dvě otevřené karty nad týmž závodem by si přepisovaly rozepsané hodnoty a
 * každá by hlásila jiný konflikt. Zápůjčka v localStorage se obnovuje tepem;
 * když se držitel přestane ozývat, převezme ji další karta.
 *
 * @returns {boolean} smí tahle karta zapisovat
 */
export function useTabWriteLock(selectedRaceId, tabIdRef) {
  const [hasWriteLock, setHasWriteLock] = useState(true);
  const lastLockKeyRef = useRef(null);

  useEffect(() => {
    if (!selectedRaceId) {
      setHasWriteLock(true);
      return undefined;
    }

    const lockKey = `timekeeper_timing_lock_${selectedRaceId}`;
    const tabId = tabIdRef.current;

    const safeParse = (value) => {
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    };

    const readLock = () => safeParse(localStorage.getItem(lockKey));
    const writeLock = () => {
      localStorage.setItem(lockKey, JSON.stringify({ tab_id: tabId, ts: Date.now() }));
    };
    const isStale = (lock) => !lock?.ts || (Date.now() - Number(lock.ts)) > TAB_LOCK_STALE_MS;

    const releasePreviousLock = () => {
      const previousKey = lastLockKeyRef.current;
      if (!previousKey || previousKey === lockKey) return;
      const lock = safeParse(localStorage.getItem(previousKey));
      if (lock?.tab_id === tabId) {
        localStorage.removeItem(previousKey);
      }
    };

    const ensureLockState = () => {
      const lock = readLock();
      if (!lock || lock.tab_id === tabId || isStale(lock)) {
        writeLock();
        setHasWriteLock(true);
        return;
      }
      setHasWriteLock(false);
    };

    releasePreviousLock();
    lastLockKeyRef.current = lockKey;
    ensureLockState();

    const heartbeat = () => {
      const lock = readLock();
      if (!lock || lock.tab_id === tabId || isStale(lock)) {
        writeLock();
        setHasWriteLock(true);
      } else {
        setHasWriteLock(false);
      }
    };

    const onStorage = (event) => {
      if (event.key === lockKey) {
        ensureLockState();
      }
    };

    const intervalId = window.setInterval(heartbeat, TAB_LOCK_HEARTBEAT_MS);
    window.addEventListener('storage', onStorage);

    const releaseLock = () => {
      const lock = readLock();
      if (lock?.tab_id === tabId) {
        localStorage.removeItem(lockKey);
      }
    };

    window.addEventListener('beforeunload', releaseLock);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('beforeunload', releaseLock);
      releaseLock();
    };
  }, [selectedRaceId]);
  return hasWriteLock;
}
