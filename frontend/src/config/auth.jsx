// Admin authentication context
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createTokenStore, fetchProfile, loginWithCredentials } from './authCore.js';

const AuthContext = createContext();
const store = createTokenStore('admin_token');

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => store.getToken());

  const logout = useCallback(() => {
    store.clear();
    setToken(null);
    setAdmin(null);
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
      .then((adminData) => {
        if (!cancelled) setAdmin(adminData);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Auth check failed:', error);
        logout();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [logout]);

  const login = useCallback(async (email, password) => {
    try {
      const { access_token, user } = await loginWithCredentials({
        loginEndpoint: '/api/admin/auth/login',
        meEndpoint: '/api/admin/auth/me',
        store,
        email,
        password
      });
      setToken(access_token);
      setAdmin(user);
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // Memoized so consumers don't re-render on every provider render.
  const value = useMemo(() => ({
    admin,
    loading,
    login,
    logout,
    isAuthenticated: !!admin,
    token
  }), [admin, loading, login, logout, token]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
