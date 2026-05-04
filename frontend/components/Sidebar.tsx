'use client';

import { clsx } from 'clsx';
import {
    Bell,
    Building2,
    FileText,
    LayoutDashboard,
    LogOut,
    Mail,
    Settings,
    Users,
    X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import useUnreadNotifications from '../hooks/useUnreadNotifications';
import { ROLES_RECEPTION_COURRIERS } from '../types';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/courriers', label: 'Courriers', icon: Mail },
  { href: '/courriers/nouveau', label: 'Nouveau courrier', icon: FileText },
  { href: '/utilisateurs', label: 'Utilisateurs', icon: Users, adminOnly: true },
  { href: '/directions', label: 'Directions', icon: Building2, adminOnly: true },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/parametres', label: 'Paramètres', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { unreadCount } = useUnreadNotifications();
  const { isOpen, close } = useSidebar();

  const isAdmin = user?.role === 'ADMIN';
  const mustChangePassword = Boolean(user?.mustChangePassword || user?.must_change_password);
  const canCreateCourrier = user?.role ? ROLES_RECEPTION_COURRIERS.includes(user.role) : false;
  const badgeValue = unreadCount > 99 ? '99+' : String(unreadCount);

  const sidebarContent = (
    <aside className="flex w-72 h-full text-white flex-col border-r border-slate-700/60 bg-[linear-gradient(180deg,#0e2f6d_0%,#0c2558_60%,#0d3f67_100%)]">
      {/* Logo + close button (mobile) */}
      <div className="px-4 md:px-6 py-5 border-b border-white/15 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex items-center justify-center shadow-lg shadow-slate-900/20 flex-shrink-0">
            <Image src="/logo-fps.png" alt="Logo FPS" width={40} height={40} className="object-contain w-full h-full" />
          </div>
          <div>
            <p className="font-extrabold text-base leading-tight tracking-tight">GED FPS</p>
            <p className="text-slate-200/80 text-xs">Gestion des courriers</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={close}
          className="md:hidden p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Fermer le menu"
        >
          <X size={20} />
        </button>
      </div>

      {/* User info */}
      <div className="px-5 py-4 border-b border-white/10 bg-white/5">
        <p className="text-sm font-semibold truncate">{user?.fullname}</p>
        <p className="text-sky-100/80 text-xs truncate">{user?.role}</p>
        {user?.direction_name && (
          <p className="text-sky-200/65 text-xs truncate mt-0.5">{user.direction_name}</p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, adminOnly }) => {
          if (mustChangePassword && href !== '/parametres') return null;
          if (adminOnly && !isAdmin) return null;
          if (href === '/courriers/nouveau' && !canCreateCourrier) return null;
          const isActive = pathname === href || pathname.startsWith(href + '/');
          const isNotificationsItem = href === '/notifications';
          return (
            <Link
              key={href}
              href={href}
              onClick={close}
              className={clsx(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300',
                isActive
                  ? 'bg-white/18 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.24)]'
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span>{label}</span>
              {isNotificationsItem && unreadCount > 0 ? (
                <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-5 text-center border border-white/40">
                  {badgeValue}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={() => { close(); logout(); }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-200 hover:bg-white/10 hover:text-white transition-all w-full"
        >
          <LogOut size={18} className="flex-shrink-0" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — static */}
      <div className="hidden md:flex flex-shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </div>

      {/* Mobile sidebar — overlay drawer */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl animate-slide-in-left">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
