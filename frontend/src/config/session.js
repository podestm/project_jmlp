/**
 * Jedno přihlášení pro administraci i časomíru.
 *
 * Obě sekce dostávají od backendu stejný JWT (sub = id účtu, role) a obě
 * ho teď drží pod stejným klíčem: kdo se přihlásí v jedné, je přihlášený
 * i v druhé, a odhlášení platí pro obě. Co smí, hlídá role - časoměřič
 * (role timekeeper) do administrace nesmí, to kontroluje backend u každého
 * admin endpointu a frontend v config/auth.jsx.
 *
 * Do 3. 10. 2026 měla každá sekce vlastní klíč (admin_token,
 * timekeeper_token). migrateLegacySession je jednou převede, ať nasazení
 * nikoho neodhlásí - hlavně ne časoměřiče offline na závodě.
 */
export const SESSION_TOKEN_KEY = 'auth_token';
export const SESSION_USER_KEY = 'auth_user';

const expKey = (tokenKey) => `${tokenKey}_expires_at`;

const LEGACY_TOKEN_KEYS = ['admin_token', 'timekeeper_token'];
const LEGACY_TIMEKEEPER_USER_KEY = 'timekeeper_user';

/** Konec platnosti uloženého tokenu v ms; bez údaje Infinity (stejně jako isExpired v authCore). */
const expiresAt = (storage, tokenKey) => {
  const raw = Number(storage.getItem(expKey(tokenKey)));
  return Number.isFinite(raw) && raw > 0 ? raw : Infinity;
};

/**
 * Převede tokeny z dob dvou přihlášení na společný.
 *
 * Když jsou platné oba, vyhraje novější přihlášení (pozdější konec
 * platnosti). Uložený profil časoměřiče (pro offline start) se převezme jen
 * s jeho tokenem - k cizímu tokenu by nepatřil.
 */
export function migrateLegacySession(storage = globalThis.localStorage, now = Date.now()) {
  if (!storage) return;
  try {
    if (!storage.getItem(SESSION_TOKEN_KEY)) {
      const candidates = LEGACY_TOKEN_KEYS
        .map((key) => ({ key, token: storage.getItem(key), exp: expiresAt(storage, key) }))
        .filter((candidate) => candidate.token && candidate.exp > now)
        .sort((a, b) => b.exp - a.exp);
      const chosen = candidates[0];
      if (chosen) {
        storage.setItem(SESSION_TOKEN_KEY, chosen.token);
        if (Number.isFinite(chosen.exp)) storage.setItem(expKey(SESSION_TOKEN_KEY), String(chosen.exp));
        const cachedUser = storage.getItem(LEGACY_TIMEKEEPER_USER_KEY);
        if (chosen.key === 'timekeeper_token' && cachedUser) storage.setItem(SESSION_USER_KEY, cachedUser);
      }
    }
    LEGACY_TOKEN_KEYS.forEach((key) => {
      storage.removeItem(key);
      storage.removeItem(expKey(key));
    });
    storage.removeItem(LEGACY_TIMEKEEPER_USER_KEY);
  } catch {
    // Zablokované úložiště - přihlásí se znovu, nic víc se nestane.
  }
}
