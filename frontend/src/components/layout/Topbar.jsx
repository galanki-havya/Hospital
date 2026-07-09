import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Bell, LogOut, User, ChevronDown, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useQuery } from '@tanstack/react-query';
import { notificationApi } from '../../api/index.js';
import clsx from 'clsx';

function useBreadcrumb() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  return parts.map((p, i) => ({
    label: p.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    to: '/' + parts.slice(0, i + 1).join('/'),
  }));
}

export default function Topbar({ onMenuToggle }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const crumbs = useBreadcrumb();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.list().then((r) => r.data.data),
    refetchInterval: 60_000,
  });

  const unread = notifData?.filter((n) => !n.isRead).length ?? 0;

  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header className="h-14 bg-white border-b border-slate-100 flex items-center px-4 gap-3 shrink-0 z-10">
      <button onClick={onMenuToggle} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
        <Menu className="w-4 h-4" />
      </button>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-slate-500 min-w-0">
        {crumbs.map((c, i) => (
          <span key={c.to} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-300">/</span>}
            <span className={clsx('truncate', i === crumbs.length - 1 ? 'text-slate-800 font-medium' : 'text-slate-400')}>
              {c.label}
            </span>
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.firstName?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-slate-800 leading-tight">{user?.firstName} {user?.lastName}</p>
              <p className="text-[11px] text-slate-400 leading-tight">{role?.name}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-100 rounded-xl shadow-lg py-1 z-50">
              <button
                onClick={() => { setUserMenuOpen(false); navigate('/profile'); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <User className="w-4 h-4" /> My Profile
              </button>
              <button
                onClick={() => { setUserMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Settings className="w-4 h-4" /> Settings
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
