import { useCallback, useEffect, useState } from 'react';
import { getSyncQueueStats } from './timekeeperOffline.js';
import { TimekeeperAPI } from '../config/api.js';

const POLL_INTERVAL_MS = 3000;

export const useSyncStatus = () => {
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [stats, setStats] = useState({ pending: 0, failed: 0, processing: 0, conflict: 0, total: 0 });

  const refreshStats = useCallback(async () => {
    const next = await getSyncQueueStats();
    setStats(next);
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
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

    const interval = window.setInterval(refreshStats, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(interval);
    };
  }, [refreshStats]);

  const syncState = !isOnline
    ? 'offline'
    : stats.processing > 0
      ? 'syncing'
      : stats.conflict > 0
        ? 'conflict'
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
