import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || '';

// Admin and timekeeper navigation is internal traffic - counting it would
// inflate the public visitor statistics on the dashboard.
const IGNORED_PREFIXES = ['/admin', '/timekeeper'];

/**
 * Hook pro automatické logování návštěv stránek.
 * Zavolá backend endpoint při každé změně cesty.
 */
export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    if (IGNORED_PREFIXES.some((prefix) => path.startsWith(prefix))) return;

    const url = `${API_BASE}/visitor-log`;
    const body = JSON.stringify({ path });

    // sendBeacon is fire-and-forget and survives an immediate navigation away.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      return;
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch((error) => {
      // Tichý fail - logování nesmí pokazit UX
      console.debug('Failed to log visit:', error);
    });
  }, [location.pathname]);
}
