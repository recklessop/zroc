// src/components/layout/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, GitFork, Server, Cpu,
  ShieldAlert, Database, Settings, ChevronLeft,
  ChevronRight, Activity, Calculator,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import clsx from 'clsx';

function ZrocLogo({ collapsed }) {
  return (
    <div className={clsx(
      'flex items-center gap-2.5 px-4 h-14 border-b border-border flex-shrink-0',
      collapsed && 'justify-center px-0',
    )}>
      <div className="relative flex-shrink-0">
        <div className="w-7 h-7 border border-accent rounded-sm flex items-center justify-center bg-accent/10 shadow-glow-sm">
          <Activity size={14} className="text-accent" />
        </div>
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-ok rounded-full shadow-glow-ok animate-pulse-led" />
      </div>
      {!collapsed && (
        <div>
          <p className="font-mono text-sm font-semibold text-text-primary leading-none">
            z<span className="text-accent">ROC</span>
          </p>
          <p className="font-mono text-[9px] text-text-muted leading-none mt-0.5 uppercase tracking-widest">
            Observability Console
          </p>
        </div>
      )}
    </div>
  );
}

const NAV_ITEMS = [
  { to: '/',           label: 'Overview',   icon: LayoutDashboard, exact: true },
  { to: '/vpgs',       label: 'VPGs',       icon: GitFork    },
  { to: '/vms',        label: 'VMs',        icon: Server     },
  { to: '/vras',       label: 'VRAs',       icon: Cpu        },
  { to: '/encryption', label: 'Encryption', icon: ShieldAlert },
  { to: '/storage',    label: 'Storage',    icon: Database   },
  { to: '/planner',    label: 'Planner',    icon: Calculator },
];

const ADMIN_ITEMS = [
  { to: '/settings/users', label: 'Users', icon: Settings },
];

function NavItem({ to, label, icon: Icon, collapsed, exact }) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 group relative',
          collapsed ? 'justify-center' : '',
          isActive
            ? 'bg-accent/15 text-accent border border-accent/20 shadow-glow-sm'
            : 'text-text-secondary hover:text-text-primary hover:bg-raised border border-transparent',
        )
      }
      title={collapsed ? label : undefined}
    >
      {({ isActive }) => (
        <>
          <Icon size={16} className={clsx('flex-shrink-0 transition-colors', isActive ? 'text-accent' : 'group-hover:text-text-primary')} />
          {!collapsed && <span className="font-medium">{label}</span>}
          {isActive && !collapsed && <span className="ml-auto w-1 h-1 rounded-full bg-accent" />}
          {collapsed && (
            <span className="absolute left-full ml-2 px-2 py-1 bg-raised border border-border rounded text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity duration-150 shadow-panel">
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ open, onToggle }) {
  const { isAdmin } = useAuth();
  const collapsed   = !open;

  return (
    <aside className={clsx(
      'flex flex-col bg-surface border-r border-border flex-shrink-0 transition-all duration-200 ease-in-out',
      collapsed ? 'w-14' : 'w-56',
    )}>
      <ZrocLogo collapsed={collapsed} />

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
        <div className={clsx(!collapsed && 'mb-1')}>
          {!collapsed && <p className="section-title px-3 mb-2">Monitor</p>}
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} collapsed={collapsed} />
          ))}
        </div>

        {isAdmin && (
          <div className={clsx(!collapsed && 'pt-3 mt-3 border-t border-border')}>
            {collapsed && <div className="border-t border-border my-2 mx-2" />}
            {!collapsed && <p className="section-title px-3 mb-2">Admin</p>}
            {ADMIN_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} collapsed={collapsed} />
            ))}
          </div>
        )}
      </nav>

      <button
        onClick={onToggle}
        className="flex items-center justify-center h-10 border-t border-border text-text-muted hover:text-text-primary hover:bg-raised transition-colors duration-150 flex-shrink-0"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  );
}
