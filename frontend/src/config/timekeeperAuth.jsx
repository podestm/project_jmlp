// Timekeeper authentication context - separate from admin auth
import React, { createContext, useContext, useState, useEffect } from 'react';
import API from './api.js';

const TimekeeperAuthContext = createContext();

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
  const [token, setToken] = useState(localStorage.getItem('timekeeper_token'));

  useEffect(() => {
    if (token) {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, []);

  const checkAuth = async () => {
    // When offline, trust the stored token — don't log the user out
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const stored = localStorage.getItem('timekeeper_user');
      if (stored) {
        try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
      } else {
        setUser({ email: 'offline', role: 'timekeeper' });
      }
      setLoading(false);
      return;
    }
    try {
      const userData = await API.get('/api/timekeeper/auth/me', {}, {
        'Authorization': `Bearer ${token}`
      });
      setUser(userData);
      try { localStorage.setItem('timekeeper_user', JSON.stringify(userData)); } catch { /* ignore */ }
    } catch (error) {
      // Network error while online — still trust cached user
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError') || error?.message?.includes('Load failed')) {
        const stored = localStorage.getItem('timekeeper_user');
        if (stored) {
          try { setUser(JSON.parse(stored)); } catch { logout(); }
        } else {
          logout();
        }
      } else {
        console.error('Timekeeper auth check failed:', error);
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await API.post('/api/timekeeper/auth/login', { email, password });
      const { access_token } = response;
      
      localStorage.setItem('timekeeper_token', access_token);
      setToken(access_token);
      
      const userData = await API.get('/api/timekeeper/auth/me', {}, {
        'Authorization': `Bearer ${access_token}`
      });
      setUser(userData);
      try { localStorage.setItem('timekeeper_user', JSON.stringify(userData)); } catch { /* ignore */ }
      
      return { success: true };
    } catch (error) {
      console.error('Timekeeper login failed:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('timekeeper_token');
    localStorage.removeItem('timekeeper_user');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    token
  };

  return (
    <TimekeeperAuthContext.Provider value={value}>
      {children}
    </TimekeeperAuthContext.Provider>
  );
};
