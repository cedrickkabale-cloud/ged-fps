'use client';

import { Bell, Menu, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import useUnreadNotifications from '../hooks/useUnreadNotifications';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth();
  const { unreadCount } = useUnreadNotifications();
  const badgeValue = unreadCount > 99 ? '99+' : String(unreadCount);
  const router = useRouter();
  const [searchValue, setSearchValue] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const { toggle } = useSidebar();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchValue.trim();
    if (!q) return;
    router.push(`/courriers?search=${encodeURIComponent(q)}`);
    setSearchValue('');
    setShowMobileSearch(false);
  };

  return (
    <header className="glass border-b border-slate-200/70 px-3 md:px-5 lg:px-6 py-3 md:py-4 flex items-center gap-3 sticky top-0 z-20">
      {/* Hamburger — mobile only */}
      <button
        onClick={toggle}
        className="md:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex-shrink-0"
        aria-label="Ouvrir le menu"
      >
        <Menu size={22} />
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg md:text-2xl font-bold text-slate-900 tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs md:text-sm text-slate-500 mt-0.5 truncate hidden sm:block">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        {/* Recherche rapide — desktop */}
        <form onSubmit={handleSearch} className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Rechercher un courrier..."
            className="pl-9 pr-4 py-2.5 text-sm border border-slate-200 bg-white/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 w-64 lg:w-72"
          />
        </form>

        {/* Recherche — icône mobile */}
        <button
          onClick={() => setShowMobileSearch((v) => !v)}
          className="md:hidden p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-white transition-colors border border-slate-200"
          aria-label="Rechercher"
        >
          {showMobileSearch ? <X size={18} /> : <Search size={18} />}
        </button>

        {/* Notifications */}
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative p-2 md:p-2.5 text-slate-500 hover:text-slate-700 hover:bg-white rounded-xl transition-colors border border-slate-200"
        >
          <Bell size={18} />
          {unreadCount > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-5 text-center border-2 border-white">
              {badgeValue}
            </span>
          ) : null}
        </Link>

        {/* Avatar */}
        <div className="w-8 h-8 md:w-9 md:h-9 bg-[linear-gradient(135deg,#0b5bd3,#0d8e76)] rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md shadow-blue-300/50 flex-shrink-0">
          {user?.fullname?.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Barre de recherche mobile — déroulante */}
      {showMobileSearch && (
        <div className="md:hidden absolute top-full left-0 right-0 z-30 bg-white border-b border-slate-200 px-4 py-3 shadow-lg">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Rechercher un courrier..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 bg-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              autoFocus
            />
          </form>
        </div>
      )}
    </header>
  );
}
