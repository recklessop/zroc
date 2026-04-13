// src/auth/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  const checkSession = useCallback(async () => {
    if (import.meta.env.VITE_MOCK_AUTH === 'true') {
      setUser({ name: 'Demo User', email: 'demo@zroc.local', role: 'admin' });
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/status', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.authenticated ? data.user : null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);

  const login = () => {
    window.location.href = `/api/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
  };

  const logout = async () => {
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const { redirectUrl } = await res.json();
        setUser(null);
        window.location.href = redirectUrl || '/';
      }
    } catch {
      setUser(null);
      window.location.href = '/';
    }
  };

  const isAdmin  = user?.role === 'admin';
  const isViewer = !!user;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isViewer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
