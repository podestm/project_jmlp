// Klouzavé prodlužování přihlášení.
//
// Token má pevnou platnost (ACCESS_TOKEN_EXPIRE_MINUTES, v provozu 12 h) od
// vydání. Bez obnovy vypadne časoměřič, který se přihlásil večer předem nebo
// brzy ráno, uprostřed závodu. Proto si klient platný token sám obnoví
// (POST .../auth/refresh), když je online a zbývá méně než půlka platnosti:
// při startu, při návratu do záložky, po obnovení připojení a periodicky.
//
// Nikdy nic nemaže ani neodhlašuje: nepovedená obnova (offline, výpadek,
// 401) jen nechá token, jaký je - o vypršení se postará obvyklá cesta
// (v časomíře přihlášení v okně na místě, viz timekeeperAuth.jsx).
import API from './api.js';
import { isOnline, onBackOnline } from '../offline/connectivity.js';

/** Když token nemá `iat` (vydaný před zavedením obnovy), počítá se s 12 h. */
export const FALLBACK_LIFETIME_SECONDS = 12 * 60 * 60;
export const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/** Nárok `exp` a `iat` z JWT (sekundy), nebo null u nečitelného tokenu. */
export function decodeTokenTimes(token) {
  try {
    const part = String(token).split('.')[1];
    if (!part) return null;
    const json = atob(
      part
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(part.length / 4) * 4, '='),
    );
    const claims = JSON.parse(json);
    const exp = Number(claims.exp);
    if (!Number.isFinite(exp)) return null;
    const iat = Number(claims.iat);
    return { exp, iat: Number.isFinite(iat) ? iat : null };
  } catch {
    return null;
  }
}

/**
 * Je čas token obnovit? Platný a zbývá méně než půlka platnosti.
 * Vypršelý token obnovit nejde (server vrátí 401), takže false.
 */
export function needsRefresh(token, nowMs = Date.now()) {
  const times = decodeTokenTimes(token);
  if (!times) return false;
  const now = nowMs / 1000;
  const remaining = times.exp - now;
  if (remaining <= 0) return false;
  const lifetime = times.iat != null ? times.exp - times.iat : FALLBACK_LIFETIME_SECONDS;
  return remaining < lifetime / 2;
}

/**
 * Hlídač obnovy tokenu pro jednu sekci.
 *
 * @param {object} options
 * @param {string} options.endpoint  '/api/timekeeper/auth/refresh' | '/api/admin/auth/refresh'
 * @param {object} options.store     createTokenStore(...) - odkud token číst a kam uložit nový
 * @param {(token: string) => void} [options.onRefreshed]
 * @returns {{ check: () => Promise<boolean>, stop: () => void }}
 */
export function startTokenRefresh({
  endpoint,
  store,
  onRefreshed,
  intervalMs = REFRESH_INTERVAL_MS,
}) {
  let running = false;
  let stopped = false;

  const check = async () => {
    if (stopped || running || !isOnline()) return false;
    const token = store.getToken();
    if (!token || !needsRefresh(token)) return false;
    running = true;
    try {
      const { access_token, expires_in } = await API.post(
        endpoint,
        {},
        { Authorization: `Bearer ${token}` },
      );
      // Mezitím se mohl někdo odhlásit nebo přihlásit jinak - pak nic nepřepisovat.
      if (stopped || store.getToken() !== token) return false;
      store.save(access_token, expires_in);
      onRefreshed?.(access_token);
      return true;
    } catch {
      // Offline, výpadek nebo už neplatný token - nic nemazat, zkusí se příště.
      return false;
    } finally {
      running = false;
    }
  };

  const onVisible = () => {
    if (typeof document === 'undefined' || !document.hidden) check();
  };

  const stopBackOnline = onBackOnline(check);
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
  }
  const timer = typeof window !== 'undefined' ? window.setInterval(check, intervalMs) : null;
  check();

  return {
    check,
    stop: () => {
      stopped = true;
      stopBackOnline();
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', check);
        document.removeEventListener('visibilitychange', onVisible);
        window.clearInterval(timer);
      }
    },
  };
}
