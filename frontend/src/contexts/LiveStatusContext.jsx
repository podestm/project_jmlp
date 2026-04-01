import { createContext, useContext, useState, useEffect } from 'react';

const LiveStatusContext = createContext(undefined);

const POLL_INTERVAL_MS = 15000;

export function LiveStatusProvider({ children }) {
  const [liveRace, setLiveRace] = useState(undefined); // undefined = loading, null = not live

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('/races/live', { cache: 'no-store' });
        if (cancelled) return;
        setLiveRace(res.ok ? await res.json() : null);
      } catch {
        if (!cancelled) setLiveRace(null);
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <LiveStatusContext.Provider value={liveRace}>
      {children}
    </LiveStatusContext.Provider>
  );
}

export function useLiveStatus() {
  return useContext(LiveStatusContext);
}
