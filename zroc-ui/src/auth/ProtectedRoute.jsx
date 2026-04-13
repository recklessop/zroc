// src/auth/ProtectedRoute.jsx
import { useEffect } from 'react';
import { useAuth } from './AuthContext';

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
        <p className="font-mono text-xs text-text-muted uppercase tracking-widest">
          Verifying session…
        </p>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }) {
  const { user, loading, login } = useAuth();

  useEffect(() => {
    if (!loading && !user) login();
  }, [loading, user, login]);

  if (loading) return <LoadingScreen />;
  if (!user)   return <LoadingScreen />;

  return children;
}

export function AdminRoute({ children }) {
  const { user, loading, login, isAdmin } = useAuth();

  useEffect(() => {
    if (!loading && !user) login();
  }, [loading, user, login]);

  if (loading) return <LoadingScreen />;
  if (!user)   return <LoadingScreen />;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen bg-canvas">
        <div className="card p-10 text-center max-w-sm">
          <p className="font-mono text-crit text-lg mb-2">403</p>
          <p className="text-text-secondary text-sm">
            This page requires administrator privileges.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
