/**
 * Hledání rychlosti (baud) časomíry.
 *
 * Časomíra připojená 2. 10. 2026 vysílala na 19200 baudech, aplikace četla na
 * 9600 a hlásila jen "Spojení s časomírou se přerušilo". Hledání projde
 * rychlosti jednu po druhé: na každé chvíli poslouchá a první, na které
 * přijde čitelný řádek (čas z časomíry nebo její úvodní hlášení po zapnutí),
 * se uloží. Obsluha mezitím posílá z časomíry časy nebo ji vypne a zapne.
 *
 * Pravidla, na kterých se domluvil provoz:
 *  - rychlost se nikdy nepřepíná sama uprostřed závodu - jedna chyba
 *    přenosu může být šum na kabelu. Hledání se spouští jen tlačítkem;
 *  - rychlost, na které už přišel platný řádek, je ověřená (BAUD_LOCK_KEY)
 *    a obrazovka ji při chybách přenosu jen doporučí zkontrolovat.
 *
 * Samotné otevírání portu dělá SerialSessionProvider (jediný vlastník portu);
 * tady je jen postup, aby šel otestovat bez zařízení.
 */
import { BAUD_OPTIONS, parseTimingDeviceLine } from '../../utils/serial.js';

/** Rychlost, na které už přišel platný řádek z časomíry. */
export const BAUD_LOCK_KEY = 'timekeeper_serial_baud_locked';

/** Pořadí zkoušení: 19200 má LIP TIMER na závodech, pak běžné rychlosti. */
export const BAUD_DETECTION_ORDER = [19200, 9600, 38400, 115200, 4800, 2400, 57600, 1200];

/** Jak dlouho se na jedné rychlosti poslouchá. */
export const DETECTION_WINDOW_MS = 6000;

/** Nastavená rychlost jako první, pak ostatní v pořadí BAUD_DETECTION_ORDER. */
export const detectionCandidates = (current) => {
  const first = Number(current);
  const rest = BAUD_DETECTION_ORDER.filter((baud) => baud !== first);
  return (BAUD_OPTIONS.includes(first) ? [first, ...rest] : rest);
};

// Znak náhrady (nečitelný bajt) a řídicí znaky - na špatné rychlosti jich
// přijde plno, v řádku z časomíry žádný.
// eslint-disable-next-line no-control-regex
const GARBAGE = /[�\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/**
 * Je řádek čitelný, tedy přijatý na správné rychlosti?
 * Čas nebo stav z časomíry, nebo její úvodní hlášení ("(c)LIP", "Ver: 3.01").
 */
export const isCleanDeviceLine = (line) => {
  const text = String(line ?? '').trim();
  if (!text || GARBAGE.test(text)) return false;
  if (parseTimingDeviceLine(text)) return true;
  return /\bLIP\b|\bVer\b/i.test(text);
};

/**
 * Projde rychlosti a vrátí první, na které přišel čitelný řádek.
 *
 * @param {object} io
 * @param {number[]} io.candidates           rychlosti v pořadí zkoušení
 * @param {(baud: number) => Promise<boolean>} io.open  připojí port na rychlosti
 * @param {(ms: number) => Promise<'clean'|'error'|'timeout'|'cancelled'>} io.listen
 *   počká na první čitelný řádek; 'error' = chyba přenosu (čtení skončilo)
 * @param {() => boolean} io.cancelled       obsluha hledání zastavila
 * @param {(progress: {baud: number, index: number, total: number}) => void} [io.onProgress]
 * @param {number} [io.windowMs]
 * @returns {Promise<number|null>} nalezená rychlost, nebo null
 */
export async function runBaudDetection({
  candidates, open, listen, cancelled, onProgress, windowMs = DETECTION_WINDOW_MS,
}) {
  for (let index = 0; index < candidates.length; index += 1) {
    if (cancelled()) return null;
    const baud = candidates[index];
    onProgress?.({ baud, index, total: candidates.length });

    const opened = await open(baud);
    if (cancelled()) return null;
    if (!opened) continue;

    const outcome = await listen(windowMs);
    if (outcome === 'clean') return baud;
    if (outcome === 'cancelled' || cancelled()) return null;
  }
  return null;
}
