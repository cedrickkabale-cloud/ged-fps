'use client';

import { clsx } from 'clsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell, CheckCheck, CheckCircle2, Mail, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { NOTIFICATIONS_COUNT_UPDATED_EVENT } from '../../hooks/useUnreadNotifications';
import api from '../../lib/api';
import { Notification } from '../../types';

type NotificationItem = Notification & {
  courrier_id?: number;
  type?: string;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const redirectAccessDenied = (action: string) => {
    router.replace(`/acces-refuse?action=${action}&from=%2Fnotifications`);
  };

  const emitUnreadCount = (count: number) => {
    window.dispatchEvent(
      new CustomEvent(NOTIFICATIONS_COUNT_UPDATED_EVENT, {
        detail: { unreadCount: count },
      })
    );
  };

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      const nextCount = Number(response.data.unreadCount || 0);
      setNotifications(response.data.data || []);
      setUnreadCount(nextCount);
      emitUnreadCount(nextCount);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('manage_notifications');
        return;
      }
      toast.error('Erreur de chargement des notifications');
    } finally {
      setIsLoading(false);
    }
  };

  // Chargement initial volontaire au montage de la page.
  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => {
        const next = Math.max(0, prev - 1);
        emitUnreadCount(next);
        return next;
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('mark_notification_read');
        return;
      }
      toast.error('Impossible de marquer la notification comme lue');
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    setIsMarkingAll(true);
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      emitUnreadCount(0);
      toast.success('Toutes les notifications sont marquées comme lues');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('mark_all_notifications_read');
        return;
      }
      toast.error('Impossible de marquer toutes les notifications');
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Notifications" subtitle="Suivez les alertes liées aux courriers" />

        <main className="flex-1 overflow-y-auto p-4 md:p-5 lg:p-6 space-y-5">
          <section className="card bg-[linear-gradient(115deg,#0f3f8a_0%,#0d5cbf_45%,#0d8e76_100%)] text-white border-none shadow-[0_18px_45px_rgba(11,72,149,0.28)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-white/80">Centre D&apos;alertes</p>
                <h2 className="text-xl md:text-2xl mt-1 font-black">{unreadCount} notification(s) non lue(s)</h2>
                <p className="text-sm text-white/90 mt-1">Consultez et accusez réception de vos alertes en un clic.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchNotifications}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-white/15 hover:bg-white/25 border border-white/20 text-sm"
                >
                  <RefreshCw size={16} />
                  Actualiser
                </button>
                <button
                  onClick={markAllAsRead}
                  disabled={isMarkingAll || unreadCount === 0}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-white text-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold"
                >
                  <CheckCheck size={16} />
                  Tout marquer lu
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            {isLoading ? (
              <div className="card flex items-center justify-center min-h-40">
                <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="card text-center py-14">
                <Bell className="mx-auto text-slate-300" size={36} />
                <p className="mt-3 text-slate-600">Aucune notification pour le moment</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={clsx(
                    'card border transition-all',
                    notification.is_read
                      ? 'border-slate-200 bg-white'
                      : 'border-blue-200 bg-blue-50/40'
                  )}
                >
                  <div className="flex flex-wrap gap-3 items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={clsx(
                        'w-10 h-10 rounded-xl flex items-center justify-center mt-0.5',
                        notification.is_read
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-[linear-gradient(135deg,#0b5bd3,#0d8e76)] text-white'
                      )}>
                        {notification.is_read ? <CheckCircle2 size={18} /> : <Mail size={18} />}
                      </div>

                      <div>
                        <p className="text-sm text-slate-800 font-medium">{notification.message}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {format(new Date(notification.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                        </p>
                        {(notification.reference || notification.objet) && (
                          <p className="text-xs text-slate-600 mt-2">
                            <span className="font-semibold">Courrier:</span>{' '}
                            {notification.reference ? `${notification.reference} - ` : ''}
                            {notification.objet || 'Sans objet'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {notification.courrier_id && (
                        <Link
                          href={`/courriers/${notification.courrier_id}`}
                          className="btn-secondary text-xs"
                        >
                          Voir courrier
                        </Link>
                      )}

                      {!notification.is_read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="btn-primary text-xs"
                        >
                          Marquer lu
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
