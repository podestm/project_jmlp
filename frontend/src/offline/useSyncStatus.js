import { useCallback, useEffect, useRef, useState } from 'react';
import { isOnline as connectivityOnline, onBackOnline, onConnectivityChange } from './connectivity.js';
import { getSyncQueueStats, SYNC_QUEUE_EVENT } from './syncQueue.js';
import { TimekeeperAPI } from '../config/timekeeperApi.js';

// Fallback poll only - the queue also announces its own changes via SYNC_QUEUE_EVENT.
const POLL_INTERVAL_MS = 10000;

const EMPTY_STATS = { pending: 0, failed: 0, processing: 0, conflict: 0, dead: 0, total: 0 };

const sameStats = (a, b) => (
  a.pending === b.pending &&
  a.failed === b.failed &&
  a.processing === b.processing &&
  a.conflict === b.conflict &&
  a.dead === b.dead &&
  a.total === b.total
);

export const useSyncStatus = () => {
  // Skutečné spojení se serverem (connectivity.js), ne jen navigator.onLine:
  // na slabém signálu má obsluha vidět „offline“, ne „chyba synchronizace“.
  const [isOnline, setIsOnline] = useState(connectivityOnline);
  const [stats, setStats] = useState(EMPTY_STATS);
  const statsRef = useRef(EMPTY_STATS);

  // Keeping the previous object identity when nothing changed stops this hook
  // from re-rendering TimekeeperLayout (and its whole subtree) several times a
  // minute for the entire race day.
  const refreshStats = useCallback(async () => {
    const next = await getSyncQueueStats();
    if (sameStats(statsRef.current, next)) return;
    statsRef.current = next;
    setStats(next);
  }, []);

  useEffect(() => {
    refreshStats();

    const onBack = async () => {
      try {
        await TimekeeperAPI.flushQueue();
      } finally {
        refreshStats();
      }
    };

    setIsOnline(connectivityOnline());
    const stopChange = onConnectivityChange(setIsOnline);
    const stopBack = onBackOnline(onBack);
    window.addEventListener(SYNC_QUEUE_EVENT, refreshStats);

    const interval = window.setInterval(refreshStats, POLL_INTERVAL_MS);

    return () => {
      stopChange();
      stopBack();
      window.removeEventListener(SYNC_QUEUE_EVENT, refreshStats);
      window.clearInterval(interval);
    };
  }, [refreshStats]);

  const syncState = !isOnline
    ? 'offline'
    : stats.dead > 0
      ? 'dead'
      : stats.conflict > 0
        ? 'conflict'
        : stats.processing > 0
          ? 'syncing'
          : stats.failed > 0
            ? 'error'
            : stats.total > 0
              ? 'queued'
              : 'online';

  return {
    isOnline,
    syncState,
    queueStats: stats,
    refreshStats
  };
};
