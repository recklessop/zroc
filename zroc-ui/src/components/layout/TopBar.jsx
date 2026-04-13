// src/components/layout/TopBar.jsx
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, RefreshCw, ChevronDown, LogOut, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/auth/ThemeContext';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';

const PAGE_TITLES = {
  '/':                 'Overview',
  '/vpgs':             'VPG Monitor',
  '/vms':              'VM Protection',
  '/vras':             'VRA Infrastructure',
  '/encryption':       'Encryption Detection',
  '/storage':          'Storage & Datastores',
  '/planner':          'DR Capacity Planner',
  '/settings/users':   'User Management',
  '/settings':         'Settings',
};

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = user.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : user.username.slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-md hover:bg-raised border border-transparent hover:border-border transition-all duration-150">
        <div className="w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center font-mono text-xs font-semibold">
          {initials}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-xs font-medium text-text-primary leading-none">{user.name || user.username}</p>
          <p className="text-[10px] text-text-muted font-mono leading-none mt-0.5 capitalize">{user.role}</p>
        </div>
        <ChevronDown size={12} className="text-text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 card-raised shadow-panel z-50 py-1 animate-fade-in">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-medium text-text-primary">{user.name}</p>
            <p className="text-[10px] text-text-muted font-mono">{user.email}</p>
          </div>
          <button onClick={() => { setOpen(false); onLogout(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-crit hover:bg-crit/5 transition-colors">
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function TopBar({ sidebarOpen, onMenuToggle }) {
  const { user, logout }  = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const location          = useLocation();
  const queryClient       = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const title = PAGE_TITLES[location.pathname] ?? 'zROC';

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-surface flex-shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle}
          className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-raised transition-colors md:hidden">
          <Menu size={16} />
        </button>
        <h2 className="font-mono text-sm font-semibold text-text-primary">{title}</h2>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={handleRefresh} title="Refresh all data"
          className="p-1.5 rounded text-text-muted hover:text-accent hover:bg-accent/10 transition-all duration-150">
          <RefreshCw size={14} className={clsx(refreshing && 'animate-spin text-accent')} />
        </button>
        <button onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-1.5 rounded text-text-muted hover:text-accent hover:bg-accent/10 transition-all duration-150">
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        {user && <UserMenu user={user} onLogout={logout} />}
      </div>
    </header>
  );
}
