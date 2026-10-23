// Skutečné spojení se serverem, ne jen to, co hlásí prohlížeč.
//
// `navigator.onLine` říká jen „zařízení má síť“. Na kopci se slabým signálem,
// na hotspotu bez dat nebo na Wi-Fi časomíry bez internetu zůstává `true`,
// přestože na server nedojde nic. Časomíra pak zkoušela síť, fronta pálila
// pokusy o tutéž zeď a obsluha viděla „chyba synchronizace“ místo „offline“.
//
// Tady se proto drží i druhá polovina: odpověděl server? Klient časomíry po
// každé odpovědi (i 4xx/5xx) volá markReachable(), po síťové chybě nebo
// vypršení markUnreachable(). Dokud je server nedostupný, modul ho sám
// periodicky zkouší (/health) a po první odpovědi ohlásí návrat spojení.
//
// Bez vedlejších účinků při importu: veřejný web modul klidně načte (useOnline,
// tisk PDF), ale zkoušení serveru se rozběhne až po markUnreachable(), které
// volá jen klient časomíry.
import { buildUrl } from '../config/api.js';

/** Vysílá se na window při každé změně dosažitelnosti serveru. */
export const CONNECTIVITY_EVENT = 'timekeeper-connectivity-changed';

/** Hláška chyby, kterou vyhodí požadavek, na který server neodpověděl včas. */
export const TIMEOUT_MESSAGE = 'Server neodpověděl včas (výpadek spojení).';

const PROBE_PATH = '/health';
const PROBE_TIMEOUT_MS = 4000;
const PROBE_MIN_DELAY_MS = 5000;
const PROBE_MAX_DELAY_MS = 20000;

let reachable = true;
let probeTimer = null;
let probeDelay = PROBE_MIN_DELAY_MS;
let probing = false;
let windowListenersWired = false;

const hasWindow = () => typeof window !== 'undefined';

/** Hlásí prohlížeč vůbec nějakou síť? */
const browserOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

/** Dá se teď mluvit se serverem? Síť podle prohlížeče a zároveň server odpovídá. */
export const isOnline = () => browserOnline() && reachable;

const emit = () => {
  if (!hasWindow()) return;
  window.dispatchEvent(new CustomEvent(CONNECTIVITY_EVENT, { detail: { online: isOnline(), reachable } }));
};

// Chyby fetch bez HTTP odpovědi napříč prohlížeči (Chrome, Firefox, Safari)
// a vlastní hláška vypršení. „API Error: 504 …“ sem nepatří - to server
// odpověděl, jen chybou.
const NETWORK_MESSAGE = /Failed to fetch|NetworkError|Load failed|Network request failed|network connection was lost|Server neodpověděl včas/i;

/** Je text chyby (třeba last_error ve frontě) síťová chyba bez odpovědi serveru? */
export const isNetworkErrorMessage = (message) => {
  const text = String(message || '');
  if (/API Error: \d+/.test(text)) return false;
  return NETWORK_MESSAGE.test(text);
};

/**
 * Selhal požadavek na síti (žádná HTTP odpověď)? Nedorazil, visel do vypršení,
 * nebo ho klient označil `network = true`. Chyba s HTTP stavem síťová není.
 */
export const isNetworkError = (error) => {
  if (!error) return false;
  if (error.network === true) return true;
  if (typeof error.status === 'number') return false;
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;
  return isNetworkErrorMessage(error.message);
};

const stopProbe = () => {
  if (probeTimer != null) clearTimeout(probeTimer);
  probeTimer = null;
};

/** Odpoví server? Jen skutečná odpověď, ne přesměrování (captive portál). */
const pingServer = async () => {
  if (typeof fetch === 'undefined') return false;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS) : null;
  try {
    const response = await fetch(buildUrl(PROBE_PATH, { ts: Date.now() }), {
      method: 'GET',
      cache: 'no-store',
      ...(controller ? { signal: controller.signal } : {})
    });
    return Boolean(response?.ok) && !response.redirected;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

function scheduleProbe() {
  if (reachable || probeTimer != null || !hasWindow()) return;
  probeTimer = setTimeout(probe, probeDelay);
}

async function probe() {
  probeTimer = null;
  if (reachable || probing) return;
  // Bez sítě nemá cenu nic zkoušet - čeká se dál (a hned po události 'online').
  if (!browserOnline()) {
    scheduleProbe();
    return;
  }
  probing = true;
  let ok = false;
  try {
    ok = await pingServer();
  } finally {
    probing = false;
  }
  if (ok) {
    markReachable();
    return;
  }
  probeDelay = Math.min(probeDelay * 2, PROBE_MAX_DELAY_MS);
  scheduleProbe();
}

// Prohlížeč hlásí návrat sítě: zkusit server hned, ne až po odkladu.
const onWindowOnline = () => {
  if (reachable) return;
  stopProbe();
  probeDelay = PROBE_MIN_DELAY_MS;
  probe();
};

const wireWindowListeners = () => {
  if (windowListenersWired || !hasWindow()) return;
  windowListenersWired = true;
  window.addEventListener('online', onWindowOnline);
};

/** Server neodpověděl (síťová chyba, vypršení). Rozběhne zkoušení spojení. */
export const markUnreachable = () => {
  wireWindowListeners();
  if (reachable) {
    reachable = false;
    probeDelay = PROBE_MIN_DELAY_MS;
    emit();
  }
  scheduleProbe();
};

/** Server odpověděl (jakkoli, i 4xx/5xx). Zastaví zkoušení spojení. */
export function markReachable() {
  stopProbe();
  probeDelay = PROBE_MIN_DELAY_MS;
  if (reachable) return;
  reachable = true;
  emit();
}

/**
 * Odběr změn spojení: událost prohlížeče 'online'/'offline' i změna
 * dosažitelnosti serveru. `callback(online)` dostane aktuální isOnline().
 * @returns {function} odhlášení odběru
 */
export const onConnectivityChange = (callback) => {
  if (!hasWindow()) return () => {};
  const handler = () => callback(isOnline());
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  window.addEventListener(CONNECTIVITY_EVENT, handler);
  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
    window.removeEventListener(CONNECTIVITY_EVENT, handler);
  };
};

/**
 * Spojení se vrátilo: prohlížeč ohlásil 'online' a server není známý jako
 * nedostupný, nebo zkouška spojení server znovu zastihla. Jedno místo
 * místo dvou posluchačů v každém odběrateli.
 * @returns {function} odhlášení odběru
 */
export const onBackOnline = (callback) => {
  if (!hasWindow()) return () => {};
  const onOnline = () => {
    if (isOnline()) callback();
  };
  const onChange = (event) => {
    if (event?.detail?.online) callback();
  };
  window.addEventListener('online', onOnline);
  window.addEventListener(CONNECTIVITY_EVENT, onChange);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener(CONNECTIVITY_EVENT, onChange);
  };
};

/** Jen pro testy: výchozí stav (server dosažitelný, nic se nezkouší). */
export const resetConnectivity = () => {
  stopProbe();
  reachable = true;
  probing = false;
  probeDelay = PROBE_MIN_DELAY_MS;
  if (windowListenersWired && hasWindow()) window.removeEventListener('online', onWindowOnline);
  windowListenersWired = false;
};
