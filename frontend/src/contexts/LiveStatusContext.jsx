import { createContext, useContext, useEffect, useRef, useState } from 'react';

const LiveStatusContext = createContext(undefined);

// Poll often while a race is running, rarely when nothing is live.
const POLL_ACTIVE_MS = 15000;
const POLL_IDLE_MS = 120000;

export function LiveStatusProvider({ children }) {
  const [liveRace, setLiveRace] = useState(undefined); // undefined = loading, null = not live
  const liveRef = useRef(undefined);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;

    const schedule = () => {
      if (cancelled || document.hidden) return;
      const delay = liveRef.current ? POLL_ACTIVE_MS : POLL_IDLE_MS;
      timeoutId = window.setTimeout(check, delay);
    };

    const check = async () => {
      try {
        const res = await fetch('/races/live/status', { cache: 'no-store' });
        if (cancelled) return;
        const next = res.ok ? await res.json() : null;
        liveRef.current = next;
        // Keep the previous object identity while the same race stays live, so
        // every consumer of this context does not re-render on each poll.
        setLiveRace((prev) => (prev?.race_id === next?.race_id ? prev : next));
      } catch {
        if (!cancelled) {
          liveRef.current = null;
          setLiveRace((prev) => (prev === null ? prev : null));
        }
      } finally {
        schedule();
      }
    };

    // A backgrounded tab must not keep polling; resume with a fresh check.
    const onVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(timeoutId);
      } else {
        check();
      }
    };

    check();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <LiveStatusContext.Provider value={liveRace}>{children}</LiveStatusContext.Provider>;
}

export function useLiveStatus() {
  return useContext(LiveStatusContext);
}
