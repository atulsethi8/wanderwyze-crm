import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks';
import { AuthUser } from '../types';
import { Icons } from './common';

/**
 * The application frame: a fixed navy sidebar, a slim top bar carrying search and the
 * primary action, and the scrolling content well.
 *
 * The sidebar is the standard shell for a CRM - it keeps every destination one click away,
 * leaves the full page width for wide tables, and has room to grow as screens are added.
 * Below `lg` it collapses into an overlay drawer so the layout still works on a tablet.
 */

interface NavItem {
  view: string;
  label: string;
  icon: React.ReactNode;
}

const icon = (path: React.ReactNode) => (
  <svg
    className="h-[18px] w-[18px] shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.75}
    aria-hidden="true"
  >
    {path}
  </svg>
);

const PRIMARY_NAV: NavItem[] = [
  {
    view: 'dashboard',
    label: 'Dashboard',
    icon: icon(<path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />),
  },
  {
    view: 'leads',
    label: 'Leads',
    icon: icon(<path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />),
  },
  {
    view: 'calendar',
    label: 'PAX Calendar',
    icon: icon(<path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />),
  },
  {
    view: 'reports',
    label: 'Reports',
    icon: icon(<path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />),
  },
];

const ADMIN_NAV: NavItem[] = [
  {
    view: 'customers',
    label: 'Customers',
    icon: icon(<path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />),
  },
  {
    view: 'users',
    label: 'Users',
    icon: icon(<path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />),
  },
  {
    view: 'agents',
    label: 'Agents',
    icon: icon(<path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />),
  },
  {
    view: 'settings',
    label: 'Company Settings',
    icon: icon(
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </>,
    ),
  },
  {
    view: 'change_password',
    label: 'Change Password',
    icon: icon(<path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />),
  },
  {
    view: 'deleted_log',
    label: 'Deleted Dockets',
    icon: icon(<path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />),
  },
];

interface AppShellProps {
  currentUser: AuthUser | null;
  currentView: string;
  onNavigate: (view: string) => void;
  onNewDocket: () => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentUser,
  currentView,
  onNavigate,
  onNewDocket,
  searchTerm = '',
  onSearchChange,
  children,
}) => {
  const { logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const go = (view: string) => {
    setDrawerOpen(false);
    onNavigate(view);
  };

  const NavLink: React.FC<{ item: NavItem }> = ({ item }) => {
    const active = currentView === item.view;
    return (
      <button
        onClick={() => go(item.view)}
        aria-current={active ? 'page' : undefined}
        className={`group relative w-full flex items-center gap-3 pl-4 pr-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          active ? 'bg-nav-raised text-nav-active' : 'text-nav-text hover:bg-nav-raised/60 hover:text-white'
        }`}
      >
        {/* The accent marker is the only saturated colour in the sidebar, so the active
            destination is unmistakable without shouting. */}
        <span
          className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full transition-colors ${
            active ? 'bg-accent' : 'bg-transparent'
          }`}
        />
        <span className={active ? 'text-accent' : 'text-slate-500 group-hover:text-slate-300'}>
          {item.icon}
        </span>
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  const sidebar = (
    <div className="flex flex-col h-full bg-nav">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/5 shrink-0">
        <button onClick={() => go('dashboard')} className="flex items-center gap-2.5 min-w-0">
          <span className="bg-brand text-white font-bold text-sm rounded-lg w-8 h-8 flex items-center justify-center shrink-0">
            WD
          </span>
          <span className="text-[15px] font-semibold text-white tracking-tight truncate">
            WanderWyze
          </span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto scroll-slim px-3 py-4 space-y-1">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.view} item={item} />
        ))}

        {currentUser?.role === 'admin' && (
          <>
            <p className="px-4 pt-6 pb-2 text-label font-semibold uppercase text-slate-500">
              Administration
            </p>
            {ADMIN_NAV.map((item) => (
              <NavLink key={item.view} item={item} />
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-white/5 p-3 shrink-0">
        <button
          onClick={() => go('profile')}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-nav-raised transition-colors text-left"
        >
          <span className="w-8 h-8 rounded-full bg-nav-raised text-slate-200 flex items-center justify-center text-xs font-semibold shrink-0 ring-1 ring-white/10">
            {currentUser?.name?.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-white truncate">
              {currentUser?.name}
            </span>
            <span className="block text-xs text-slate-500 truncate capitalize">
              {currentUser?.role}
            </span>
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Fixed rail on large screens */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-60 z-30">{sidebar}</aside>

      {/* Overlay drawer below lg */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-64 h-full shadow-overlay">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-60 flex flex-col min-h-screen">
        <header className="h-16 bg-surface/90 backdrop-blur border-b border-line sticky top-0 z-20 flex items-center gap-3 px-4 sm:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="lg:hidden p-2 -ml-2 rounded-lg text-ink-muted hover:bg-canvas"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1 max-w-lg">
            {onSearchChange && (
              <div className="relative">
                <input
                  type="search"
                  placeholder="Search dockets, PNR, traveller, agent…"
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-canvas border border-line rounded-lg text-ink placeholder:text-ink-subtle transition-colors hover:border-line-strong focus:outline-none focus:bg-surface focus:border-brand focus:ring-2 focus:ring-brand/15"
                />
                <svg
                  className="h-4 w-4 text-ink-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onNewDocket}
              className="inline-flex items-center gap-2 bg-brand text-white px-3.5 py-2 rounded-lg text-sm font-semibold hover:bg-brand-hover transition-colors shadow-card"
            >
              {React.cloneElement(Icons.plus, { className: 'h-4 w-4' })}
              <span className="hidden sm:inline">New Docket</span>
            </button>

            <div className="relative lg:hidden" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                aria-label="Account menu"
                className="w-9 h-9 rounded-full bg-canvas border border-line flex items-center justify-center text-sm font-semibold text-ink-muted"
              >
                {currentUser?.name?.charAt(0).toUpperCase()}
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl shadow-overlay bg-surface border border-line overflow-hidden">
                  <div className="px-4 py-3 border-b border-line">
                    <p className="text-sm font-medium text-ink truncate">{currentUser?.name}</p>
                    <p className="text-xs text-ink-subtle truncate">{currentUser?.email}</p>
                  </div>
                  <button
                    onClick={() => { setProfileOpen(false); onNavigate('profile'); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink hover:bg-canvas"
                  >
                    {Icons.user} My Profile
                  </button>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink hover:bg-canvas"
                  >
                    {Icons.logout} Logout
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={logout}
              title="Log out"
              aria-label="Log out"
              className="hidden lg:inline-flex p-2 rounded-lg text-ink-subtle hover:text-ink hover:bg-canvas transition-colors"
            >
              {React.cloneElement(Icons.logout, { className: 'h-[18px] w-[18px]' })}
            </button>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
};
