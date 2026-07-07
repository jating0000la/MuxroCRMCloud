import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import settingsService from '../../services/settings';
import { brandingFromSettings, readBranding, saveBranding } from '../../utils/branding';

type NavRole = 'ALL' | 'ADMIN' | 'USER';

const navItems: Array<{
  label: string;
  path: string;
  icon: JSX.Element;
  roles?: NavRole[];
}> = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    roles: ['ALL'],
  },
  {
    label: 'Campaigns',
    path: '/campaigns',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    roles: ['ADMIN'],
  },
  {
    label: 'Follow-ups',
    path: '/followups',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    roles: ['ALL'],
  },
  {
    label: 'DND',
    path: '/dnd',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    roles: ['ALL'],
  },
  {
    label: 'Users',
    path: '/admin/users',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    roles: ['ADMIN'],
  },
];

function BottomBar({ filteredNav, currentPath }: { filteredNav: typeof navItems; currentPath: string }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-primary-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-2 sm:px-4">
        <div className="flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto py-2">
          {filteredNav.map((item) => {
          const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex min-w-[74px] sm:min-w-[96px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] sm:text-xs font-semibold transition-colors ${
                isActive ? 'text-primary-700 bg-primary-50 border border-primary-200' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className={isActive ? 'text-primary-600' : 'text-slate-400'}>{item.icon}</span>
              <span className="leading-none">{item.label}</span>
            </Link>
          );
          })}
        </div>
      </div>
    </nav>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { pendingCount, notifications, markAsRead, soundEnabled, toggleSound } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [density, setDensity] = useState<'compact' | 'comfortable'>(() => {
    const saved = localStorage.getItem('uiDensity');
    return saved === 'comfortable' ? 'comfortable' : 'compact';
  });
  const [branding, setBranding] = useState(readBranding());
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(e.target as Node)) {
        setNotificationMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-density', density);
    localStorage.setItem('uiDensity', density);
  }, [density]);

  useEffect(() => {
    let active = true;
    const loadBranding = async () => {
      try {
        const settings = await settingsService.getAllSettings(true);
        const nextBranding = brandingFromSettings(settings);
        if (!active) return;
        setBranding(nextBranding);
        saveBranding(nextBranding);
      } catch {
        // Keep local branding fallback when settings are unavailable.
      }
    };
    loadBranding();
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNav = navItems.filter((item) => {
    if (!item.roles || item.roles.includes('ALL')) return true;
    if (item.roles.includes(user?.role as any)) return true;
    return false;
  });

  return (
    <div className="min-h-screen bg-transparent flex">
      {/* Main Content */}
      <div className="flex-1 flex flex-col transition-all duration-300">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-primary-100/90 bg-white/90 backdrop-blur-xl">
          <div className="h-1 w-full bg-gradient-to-r from-primary-600 via-primary-400 to-primary-700" />
          <div className="mx-auto max-w-7xl px-3 sm:px-4 py-2.5">
            <div className="rounded-xl border border-primary-100/80 bg-white/80 px-3 py-2 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {branding.appLogoUrl ? (
                    <img
                      src={branding.appLogoUrl}
                      alt="App logo"
                      className="h-8 w-8 rounded-lg object-cover border border-primary-100 bg-white"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-primary-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      {(branding.appName || 'M').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold truncate">{branding.appName}</p>
                    <h2 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight truncate">
                      {filteredNav.find((item) => item.path === location.pathname)?.label || 'Workspace'}
                    </h2>
                  </div>
                </div>

                {/* User Menu */}
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center rounded-lg border border-primary-100 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setDensity('compact')}
                      className={`px-2 py-1 text-[11px] font-semibold rounded ${density === 'compact' ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                      Compact
                    </button>
                    <button
                      type="button"
                      onClick={() => setDensity('comfortable')}
                      className={`px-2 py-1 text-[11px] font-semibold rounded ${density === 'comfortable' ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                      Comfortable
                    </button>
                  </div>

                  {/* Notification Bell */}
                  <div className="relative" ref={notificationMenuRef}>
                    <button
                      onClick={() => setNotificationMenuOpen(!notificationMenuOpen)}
                      className={`relative flex items-center justify-center w-10 h-10 rounded-lg border bg-white transition-colors ${
                        notifications.some(n => n.type === 'overdue')
                          ? 'border-red-300 hover:bg-red-50'
                          : notifications.some(n => n.type === 'today')
                          ? 'border-amber-300 hover:bg-amber-50'
                          : 'border-primary-100 hover:bg-primary-50/70'
                      }`}
                      aria-label="Notifications"
                    >
                      <svg className={`w-5 h-5 ${notifications.some(n => n.type === 'overdue') ? 'text-red-600' : notifications.some(n => n.type === 'today') ? 'text-amber-600' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      {pendingCount > 0 && (
                        <span className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white rounded-full ${notifications.some(n => n.type === 'overdue') ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}>
                          {pendingCount > 9 ? '9+' : pendingCount}
                        </span>
                      )}
                    </button>

                    {notificationMenuOpen && (
                      <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 max-h-[480px] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm">Followup Reminders</h3>
                            <p className="text-xs text-slate-500 mt-0.5">{pendingCount} pending</p>
                          </div>
                          {/* Sound toggle */}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleSound(); }}
                            title={soundEnabled ? 'Mute alerts' : 'Enable alerts'}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${soundEnabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                          >
                            {soundEnabled ? (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0L8 14m4 4l4-4M9.172 9.172a4 4 0 000 5.656" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                              </svg>
                            )}
                            {soundEnabled ? 'Sound On' : 'Muted'}
                          </button>
                        </div>
                        {/* Notification list */}
                        <div className="overflow-y-auto flex-1">
                          {notifications.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                              <svg className="w-10 h-10 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-sm font-medium text-slate-600">All clear!</p>
                              <p className="text-xs text-slate-400 mt-1">No pending followups</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-100">
                              {notifications.map((notif) => (
                                <button
                                  key={notif.id}
                                  onClick={() => {
                                    if (!notif.isRead) markAsRead(notif.id);
                                    setNotificationMenuOpen(false);
                                  }}
                                  className={`w-full text-left px-4 py-3 transition-colors ${
                                    notif.type === 'overdue'
                                      ? 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500'
                                      : notif.type === 'today'
                                      ? 'bg-amber-50 hover:bg-amber-100 border-l-4 border-amber-500'
                                      : 'bg-green-50 hover:bg-green-100 border-l-4 border-green-500'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">
                                      {notif.type === 'overdue' ? '🔴' : notif.type === 'today' ? '⏰' : '📅'}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <div className={`text-xs font-bold uppercase tracking-wide ${notif.type === 'overdue' ? 'text-red-700' : notif.type === 'today' ? 'text-amber-700' : 'text-green-700'}`}>
                                        {notif.type === 'overdue' ? 'Overdue' : notif.type === 'today' ? 'Due Today' : 'Due Tomorrow'}
                                      </div>
                                      <div className="font-semibold text-slate-900 text-sm truncate">
                                        {notif.followup?.lead?.name || 'Unknown Lead'}
                                      </div>
                                    </div>
                                    {!notif.isRead && (
                                      <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-2 rounded-lg border border-primary-100 bg-white px-2 py-1.5 hover:bg-primary-50/70"
                    aria-label="User menu"
                    aria-expanded={userMenuOpen}
                  >
                    <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-primary-700">
                        {user?.name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div className="hidden sm:block text-left leading-tight">
                      <div className="text-xs font-semibold text-slate-700 truncate max-w-[140px]">{user?.name}</div>
                      <div className="text-[11px] text-slate-400">{user?.role}</div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-primary-100 py-1 z-50">
                      <div className="px-4 py-3 border-b border-primary-100">
                        <div className="font-semibold text-slate-900">{user?.name}</div>
                        <div className="text-sm text-slate-500">{user?.email || user?.username}</div>
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-primary-100 text-primary-700">
                          {user?.role}
                        </span>
                      </div>
                      {user?.role === 'ADMIN' && (
                        <Link
                          to="/settings"
                          onClick={() => setUserMenuOpen(false)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-primary-50 flex items-center"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Settings
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-scroll overflow-x-hidden animate-fade-up pb-24 [scrollbar-gutter:stable]">{children}</main>
        <footer className="px-4 pb-20 text-center text-xs text-slate-500">
          Copyright by Muxro Technologies 2026
        </footer>
      </div>

      {/* Global Bottom Bar */}
      <BottomBar filteredNav={filteredNav} currentPath={location.pathname} />
    </div>
  );
}
