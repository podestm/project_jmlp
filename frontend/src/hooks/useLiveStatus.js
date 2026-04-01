import { useState, useEffect } from 'react';

export function useLiveStatus(intervalMs = 30000) {
  const [liveRace, setLiveRace] = useState(undefined); // undefined = loading, null = not live

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('/races/live');
        if (cancelled) return;
        if (res.ok) {
          setLiveRace(await res.json());
        } else {
          setLiveRace(null);
        }
      } catch {
        if (!cancelled) setLiveRace(null);
      }
    };

    check();
    const interval = setInterval(check, intervalMs);
    return () => { cancelled = true; clearInterval(interval); };
  }, [intervalMs]);

  return liveRace;
}
