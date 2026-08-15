import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
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

    const onOnline = async () => {
      setIsOnline(true);
      try {
        await TimekeeperAPI.flushQueue();
      } finally {
        refreshStats();
      }
    };

    const onOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener(SYNC_QUEUE_EVENT, refreshStats);

    const interval = window.setInterval(refreshStats, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
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
