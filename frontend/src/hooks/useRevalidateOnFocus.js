import { useEffect, useRef } from 'react';

const DEFAULT_MIN_IDLE_MS = 30000;

/**
 * Znovu načte data obrazovky, když se k ní člověk vrátí.
 *
 * Stránka načítá data jen při otevření. Záložka nechaná otevřená přes noc
 * proto ráno ukazuje včerejšek, dokud ji někdo ručně neobnoví. Tenhle hook
 * zavolá `onRevalidate`:
 * - při návratu do záložky, která byla skrytá aspoň `minIdleMs` (krátké
 *   přepnutí do jiné záložky a zpět nic nespouští),
 * - při obnovení připojení, pokud je záložka vidět.
 *
 * Zapíná se ručně po obrazovkách, ne globálně. Kde je rozepsaný formulář nebo
 * otevřený dialog, předá se `enabled: false`, aby obnova nepřepsala, na čem
 * člověk právě pracuje.
 *
 * Do časoměřiče schválně nevede - ten má vlastní offline data v IndexedDB
 * a vlastní synchronizaci (src/offline/).
 */
export function useRevalidateOnFocus(
  onRevalidate,
  { enabled = true, minIdleMs = DEFAULT_MIN_IDLE_MS } = {},
) {
  // Callback se mění s každým renderem; posluchače se kvůli tomu přepojovat
  // nemusí, stačí sáhnout pro poslední verzi.
  const callbackRef = useRef(onRevalidate);
  useEffect(() => {
    callbackRef.current = onRevalidate;
  });

  useEffect(() => {
    if (!enabled) return undefined;

    let hiddenAt = null;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt === null || Date.now() - hiddenAt < minIdleMs) return;
      hiddenAt = null;
      callbackRef.current?.();
    };

    const handleOnline = () => {
      if (!document.hidden) callbackRef.current?.();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [enabled, minIdleMs]);
}
