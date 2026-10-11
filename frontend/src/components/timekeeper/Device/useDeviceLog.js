import { useEffect, useState } from 'react';
import { parseTimingDeviceLine } from '../../../utils/serial.js';
import { isCleanDeviceLine } from '../baudDetection.js';

const LOG_LIMIT = 200;

/**
 * Živý záznam řádků z časomíry (TkZarizeni): posledních 200 řádků od otevření
 * obrazovky, tak jak přišly – i nečitelné, právě na ty je záznam.
 * kind: time (čas nebo stav) | info (hlášení časomíry) | unknown (nerozpoznaný)
 */
export function useDeviceLog(subscribeLines) {
  const [log, setLog] = useState([]);

  useEffect(() => subscribeLines((line) => {
    const text = String(line ?? '').trim();
    if (!text) return;
    const kind = parseTimingDeviceLine(text) ? 'time' : (isCleanDeviceLine(text) ? 'info' : 'unknown');
    const time = new Date().toLocaleTimeString('cs-CZ');
    setLog((previous) => [{ kind, text, time }, ...previous].slice(0, LOG_LIMIT));
  }), [subscribeLines]);

  return { log, clearLog: () => setLog([]) };
}
