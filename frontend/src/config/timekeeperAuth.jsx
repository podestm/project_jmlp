// Timekeeper authentication context.
// Přihlášení je společné s administrací (config/session.js) - kdo se přihlásí
// v jedné sekci, je přihlášený i v druhé a odhlášení platí pro obě. Časomíru
// smí správce i časoměřič. Vlastní zůstává offline chování: tablet na závodě
// musí zůstat přihlášený i bez sítě.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createTokenStore, fetchProfile, isNetworkError, loginWithCredentials } from './authCore.js';
import { AUTH_EXPIRED_EVENT } from './api.js';
import { SESSION_TOKEN_KEY, SESSION_USER_KEY } from './session.js';
import { startTimekeeperSync } from './timekeeperApi.js';

const TimekeeperAuthContext = createContext();
const store = createTokenStore(SESSION_TOKEN_KEY);
const USER_KEY = SESSION_USER_KEY;

const readCachedUser = () => {
  const stored = localStorage.getItem(USER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

const cacheUser = (user) => {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Quota / private mode - not worth failing the login over.
  }
};

const isOffline = () => typeof navigator !== 'undefined' && !navigator.onLine;

export const useTimekeeperAuth = () => {
  const context = useContext(TimekeeperAuthContext);
  if (!context) {
    throw new Error('useTimekeeperAuth must be used within a TimekeeperAuthProvider');
  }
  return context;
};

export const TimekeeperAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => store.getToken());

  const logout = useCallback(() => {
    store.clear();
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const initialToken = store.getToken();
    if (!initialToken) {
      setLoading(false);
      return;
    }
    // Online + expired → force re-login. Offline + expired → keep cached user
    // so race-day timing isn't disrupted; backend 401 on next sync will clear it.
    if (store.isExpired() && !isOffline()) {
      logout();
      setLoading(false);
      return;
    }

    // When offline, trust the stored token — don't log the user out.
    if (isOffline()) {
      setUser(readCachedUser() || { email: 'offline', role: 'timekeeper' });
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetchProfile('/api/timekeeper/auth/me', initialToken)
      .then((userData) => {
        if (cancelled) return;
        setUser(userData);
        cacheUser(userData);
      })
      .catch((error) => {
        if (cancelled) return;
        // Network error while online — still trust the cached user.
        if (isNetworkError(error)) {
          const cached = readCachedUser();
          if (cached) setUser(cached);
          else logout();
          return;
        }
        console.error('Timekeeper auth check failed:', error);
        logout();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [logout]);

  /**
   * Odhlášení po vypršení tokenu.
   *
   * Časoměřičská sekce se schválně nepřesměrovává tvrdým `window.location`:
   * reload zavře otevřený Web Serial port časomíry a rozjetý závod přijde
   * o měření. API klient proto jen smaže token a vyšle událost - odhlásit
   * musí někdo, kdo to umí bez navigace, tedy tenhle kontext.
   *
   * `tokenCleared` odlišuje požadavek na popředí (token je pryč, uživatel
   * musí znovu dovnitř) od 401 na pozadí ze synchronizační fronty, kde token
   * zůstává a fronta jen čeká.
   */
  useEffect(() => {
    const onAuthExpired = (event) => {
      const detail = event?.detail || {};
      if (detail.section === '/timekeeper' && detail.tokenCleared) logout();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
  }, [logout]);

  // The offline sync loop opens IndexedDB and runs a timer, so it must only
  // start once an actual timekeeper is signed in - never for public visitors.
  useEffect(() => {
    if (!user) return undefined;
    return startTimekeeperSync();
  }, [user]);

  const login = useCallback(async (email, password) => {
    try {
      const { access_token, user: userData } = await loginWithCredentials({
        loginEndpoint: '/api/timekeeper/auth/login',
        meEndpoint: '/api/timekeeper/auth/me',
        store,
        email,
        password
      });
      setToken(access_token);
      setUser(userData);
      cacheUser(userData);
      return { success: true };
    } catch (error) {
      console.error('Timekeeper login failed:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    token
  }), [user, loading, login, logout, token]);

  return (
    <TimekeeperAuthContext.Provider value={value}>
      {children}
    </TimekeeperAuthContext.Provider>
  );
};
