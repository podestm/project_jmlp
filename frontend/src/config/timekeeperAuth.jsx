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
    try {
      const userData = await API.get('/api/timekeeper/auth/me', {}, {
        'Authorization': `Bearer ${token}`
      });
      setUser(userData);
    } catch (error) {
      console.error('Timekeeper auth check failed:', error);
      logout();
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
      
      return { success: true };
    } catch (error) {
      console.error('Timekeeper login failed:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('timekeeper_token');
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
