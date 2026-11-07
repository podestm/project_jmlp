// Admin authentication context.
//
// Přihlášení je společné s časomírou (config/session.js): kdo se přihlásil
// tam, je přihlášený i tady - pokud má roli admin. Účet časoměřiče sem
// nepustíme, ale ani ho neodhlásíme: v časomíře zůstává přihlášený.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createTokenStore, fetchProfile, loginWithCredentials } from './authCore.js';
import { SESSION_TOKEN_KEY, SESSION_USER_KEY } from './session.js';
import { startTokenRefresh } from './tokenRefresh.js';

const AuthContext = createContext();
const store = createTokenStore(SESSION_TOKEN_KEY);

const isAdmin = (user) => user?.role === 'admin';

const cacheUser = (user) => {
  try {
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  } catch {
    // Quota / private mode - not worth failing the login over.
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  // Přihlášený účet bez práv správce (časoměřič) - přihlašovací stránka
  // administrace mu vysvětlí, proč dovnitř nemůže.
  const [deniedUser, setDeniedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => store.getToken());

  /** Odhlásí z obou sekcí - přihlášení je společné. */
  const logout = useCallback(() => {
    store.clear();
    localStorage.removeItem(SESSION_USER_KEY);
    setToken(null);
    setAdmin(null);
    setDeniedUser(null);
  }, []);

  const acceptProfile = useCallback((user) => {
    if (isAdmin(user)) {
      setAdmin(user);
      setDeniedUser(null);
    } else {
      setAdmin(null);
      setDeniedUser(user);
    }
  }, []);

  // Check if user is authenticated on app load
  useEffect(() => {
    const initialToken = store.getToken();
    if (!initialToken) {
      setLoading(false);
      return;
    }
    if (store.isExpired()) {
      logout();
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetchProfile('/api/admin/auth/me', initialToken)
      .then((user) => {
        if (!cancelled) acceptProfile(user);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Auth check failed:', error);
        // Jen neplatný token se maže. Výpadek sítě nebo serveru nesmí
        // odhlásit časomíru, která sdílí stejné přihlášení.
        if (error?.status === 401) logout();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [acceptProfile, logout]);

  // Klouzavé prodlužování společného přihlášení (viz config/tokenRefresh.js).
  useEffect(() => {
    if (!admin) return undefined;
    const refresher = startTokenRefresh({
      endpoint: '/api/admin/auth/refresh',
      store,
      onRefreshed: setToken,
    });
    return refresher.stop;
  }, [admin]);

  const login = useCallback(
    async (email, password) => {
      try {
        const { access_token, user } = await loginWithCredentials({
          loginEndpoint: '/api/admin/auth/login',
          meEndpoint: '/api/admin/auth/me',
          store,
          email,
          password,
        });
        setToken(access_token);
        cacheUser(user);
        acceptProfile(user);
        return { success: true };
      } catch (error) {
        console.error('Login failed:', error);
        return { success: false, error: error.message };
      }
    },
    [acceptProfile],
  );

  // Memoized so consumers don't re-render on every provider render.
  const value = useMemo(
    () => ({
      admin,
      deniedUser,
      loading,
      login,
      logout,
      isAuthenticated: !!admin,
      token,
    }),
    [admin, deniedUser, loading, login, logout, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
