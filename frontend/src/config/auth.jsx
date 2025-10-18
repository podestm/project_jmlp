// Admin authentication context
import React, { createContext, useContext, useState, useEffect } from 'react';
import API from './api.js';

const AuthContext = createContext();

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
  const [token, setToken] = useState(localStorage.getItem('admin_token'));

  // Check if user is authenticated on app load
  useEffect(() => {
    if (token) {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, []);

  const checkAuth = async () => {
    try {
      const adminData = await API.get('/api/admin/auth/me', {}, {
        'Authorization': `Bearer ${token}`
      });
      setAdmin(adminData);
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await API.post('/api/admin/auth/login', { email, password });
      const { access_token, expires_in } = response;
      
      localStorage.setItem('admin_token', access_token);
      setToken(access_token);
      
      // Get admin details
      const adminData = await API.get('/api/admin/auth/me', {}, {
        'Authorization': `Bearer ${access_token}`
      });
      setAdmin(adminData);
      
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
    setAdmin(null);
  };

  const value = {
    admin,
    loading,
    login,
    logout,
    isAuthenticated: !!admin,
    token
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};