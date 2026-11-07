import { useEffect, useState } from 'react';

/** Od kdy je notebook bez signálu (Date), online = null. */
export const useOfflineSince = (isOnline) => {
  const [since, setSince] = useState(() => (isOnline ? null : new Date()));

  useEffect(() => {
    setSince((current) => {
      if (isOnline) return null;
      return current || new Date();
    });
  }, [isOnline]);

  return since;
};
