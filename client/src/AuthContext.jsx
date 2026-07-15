import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [alertPrefs, setAlertPrefs] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
      setAlertPrefs(data.alert_prefs);
    } catch {
      setUser(null);
      setAlertPrefs(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (username, password) => {
    const data = await api.post('/auth/login', { username, password });
    setUser(data.user);
    await refresh();
    return data.user;
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    setAlertPrefs(null);
  };

  return (
    <AuthContext.Provider value={{ user, alertPrefs, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
