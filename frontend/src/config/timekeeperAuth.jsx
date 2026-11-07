// Timekeeper authentication context.
// Přihlášení je společné s administrací (config/session.js) - kdo se přihlásí
// v jedné sekci, je přihlášený i v druhé a odhlášení platí pro obě. Časomíru
// smí správce i časoměřič. Vlastní zůstává offline chování: tablet na závodě
// musí zůstat přihlášený i bez sítě.
//
// Pravidla pro závodní den:
//  - Token se klouzavě prodlužuje (config/tokenRefresh.js), dokud je zařízení
//    občas online - přihlášení ráno nevyprší uprostřed závodu.
//  - Časomíra nikoho sama NEODHLÁSÍ. Vypršelé nebo neplatné přihlášení (401)
//    jen otevře okno pro přihlášení na místě (reauthRequired): obrazovka,
//    rozepsané časy, sériový port i offline fronta zůstávají, jak jsou, a po
//    přihlášení fronta pokračuje. Offline se okno ani neukazuje - přihlásit se
//    stejně nejde a měřit se dá dál.
//  - Odhlásit jde jen ručně (tlačítko v menu, s varováním, když ve frontě
//    něco čeká).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createTokenStore,
  fetchProfile,
  isNetworkError,
  loginWithCredentials,
} from './authCore.js';
import { AUTH_EXPIRED_EVENT } from './api.js';
import { SESSION_TOKEN_KEY, SESSION_USER_KEY } from './session.js';
import { startTimekeeperSync, TimekeeperAPI } from './timekeeperApi.js';
import { startTokenRefresh } from './tokenRefresh.js';
import { releaseAuthParked } from '../offline/syncQueue.js';
import { AUTH_EXPIRED_MESSAGE } from '../offline/sync.js';
import { isOnline } from '../offline/connectivity.js';

const TimekeeperAuthContext = createContext();
const store = createTokenStore(SESSION_TOKEN_KEY);
const USER_KEY = SESSION_USER_KEY;
const REFRESH_ENDPOINT = '/api/timekeeper/auth/refresh';

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

// Skutečné spojení se serverem (connectivity.js), ne jen navigator.onLine.
const isOffline = () => !isOnline();

const isAuthStatus = (error) => error?.status === 401;

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
  // Přihlášení vypršelo, ale nikoho neodhlašujeme - čeká se na přihlášení
  // v okně na místě (TimekeeperReauthModal).
  const [reauthRequired, setReauthRequired] = useState(false);

  /** Ruční odhlášení (tlačítko v menu). Automaticky se nevolá nikdy. */
  const logout = useCallback(() => {
    store.clear();
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setReauthRequired(false);
  }, []);

  /**
   * Přihlášení přestalo platit. S uloženým profilem zůstává časomíra
   * otevřená a jen se ukáže okno pro přihlášení; bez něj (první spuštění)
   * není co zachraňovat a ukáže se běžná přihlašovací stránka.
   */
  const requireReauth = useCallback(() => {
    const cached = readCachedUser();
    if (cached) {
      setUser((current) => current || cached);
      setReauthRequired(true);
    } else {
      logout();
    }
  }, [logout]);

  useEffect(() => {
    const initialToken = store.getToken();
    if (!initialToken) {
      // Token smazala 401 v jiné části aplikace, ale profil zůstal - stejné
      // jako vypršení: okno na místě, ne odhlášení.
      if (readCachedUser()) requireReauth();
      setLoading(false);
      return;
    }

    // Offline: věřit uloženému tokenu i profilu, i když token vypršel -
    // měření na kopci bez signálu nesmí nic přerušit.
    if (isOffline()) {
      setUser(readCachedUser() || { email: 'offline', role: 'timekeeper' });
      setLoading(false);
      return;
    }

    if (store.isExpired()) {
      requireReauth();
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
        if (isAuthStatus(error)) {
          requireReauth();
          return;
        }
        // Výpadek sítě nebo serveru - věřit uloženému profilu.
        const cached = readCachedUser();
        if (cached) setUser(cached);
        else if (!isNetworkError(error)) console.error('Timekeeper auth check failed:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requireReauth]);

  /**
   * 401 z API (na popředí i z fronty na pozadí). Schválně se NIKDY
   * neodhlašuje a nenaviguje: reload zavře sériový port časomíry a odhlášení
   * by schovalo obrazovku s rozepsanými časy. Jen se otevře okno pro
   * přihlášení na místě.
   */
  useEffect(() => {
    const onAuthExpired = (event) => {
      if (event?.detail?.section === '/timekeeper') requireReauth();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
  }, [requireReauth]);

  // The offline sync loop opens IndexedDB and runs a timer, so it must only
  // start once an actual timekeeper is signed in - never for public visitors.
  useEffect(() => {
    if (!user) return undefined;
    return startTimekeeperSync();
  }, [user]);

  // Klouzavé prodlužování platného tokenu (při startu, návratu do záložky,
  // po obnovení připojení a periodicky).
  useEffect(() => {
    if (!user || reauthRequired) return undefined;
    const refresher = startTokenRefresh({
      endpoint: REFRESH_ENDPOINT,
      store,
      onRefreshed: setToken,
    });
    return refresher.stop;
  }, [user, reauthRequired]);

  const login = useCallback(async (email, password) => {
    try {
      const { access_token, user: userData } = await loginWithCredentials({
        loginEndpoint: '/api/timekeeper/auth/login',
        meEndpoint: '/api/timekeeper/auth/me',
        store,
        email,
        password,
      });
      setToken(access_token);
      setUser(userData);
      cacheUser(userData);
      setReauthRequired(false);
      // Fronta, která čekala na přihlášení, se pošle hned.
      releaseAuthParked(AUTH_EXPIRED_MESSAGE)
        .then(() => TimekeeperAPI.flushQueue())
        .catch(() => {});
      return { success: true };
    } catch (error) {
      console.error('Timekeeper login failed:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      reauthRequired,
      isAuthenticated: !!user,
      token,
    }),
    [user, loading, login, logout, reauthRequired, token],
  );

  return <TimekeeperAuthContext.Provider value={value}>{children}</TimekeeperAuthContext.Provider>;
};
