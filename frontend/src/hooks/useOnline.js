import { useEffect, useState } from 'react';
import { isOnline, onConnectivityChange } from '../offline/connectivity.js';

/**
 * Je spojení se serverem? Živě podle prohlížeče (online/offline) i podle
 * toho, jestli server odpovídá (offline/connectivity.js) - na slabém signálu
 * navigator.onLine lže.
 */
export const useOnline = () => {
  const [online, setOnline] = useState(isOnline);

  useEffect(() => {
    setOnline(isOnline());
    return onConnectivityChange(setOnline);
  }, []);

  return online;
};
