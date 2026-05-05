'use client';

import {
    ArrowRight,
    BellRing,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock3,
    FileCheck2,
    FolderKanban,
    Megaphone,
    ScanLine,
    ShieldCheck,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

type HomeNotification = {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  courrier_id?: number;
  reference?: string;
  objet?: string;
};

const features = [
  {
    title: 'Traçabilité complète',
    description: 'Chaque courrier garde un historique clair: réception, affectation, traitement, retour.',
    icon: FileCheck2,
    accent: {
      card: 'from-[#edf6ff] via-white to-[#f9fbff]',
      iconWrap: 'border-[#9ed7ff] bg-[#e6f6ff] shadow-[0_10px_22px_rgba(22,114,193,0.14)]',
      icon: 'text-[#0f6fb5]',
      border: 'border-[#d8ebfb] hover:border-[#7cc7ff]',
      glow: 'before:bg-[radial-gradient(circle,_rgba(18,113,197,0.18)_0%,_transparent_68%)]',
    },
  },
  {
    title: 'Workflow piloté',
    description: 'Les étapes métier sont normalisées pour limiter les oublis et accélérer les validations.',
    icon: FolderKanban,
    accent: {
      card: 'from-[#fff3e5] via-white to-[#fffaf0]',
      iconWrap: 'border-[#ffd27a] bg-[#fff2cc] shadow-[0_10px_22px_rgba(232,171,35,0.18)]',
      icon: 'text-[#d48c00]',
      border: 'border-[#f7e4bb] hover:border-[#f1c251]',
      glow: 'before:bg-[radial-gradient(circle,_rgba(255,196,52,0.22)_0%,_transparent_68%)]',
    },
  },
  {
    title: 'Alertes en temps réel',
    description: 'Les notifications signalent les actions urgentes et les délais dépassés.',
    icon: BellRing,
    accent: {
      card: 'from-[#fff0f0] via-white to-[#fff8f8]',
      iconWrap: 'border-[#ffb4b4] bg-[#ffe9e9] shadow-[0_10px_22px_rgba(220,53,69,0.16)]',
      icon: 'text-[#d62839]',
      border: 'border-[#f6d6d6] hover:border-[#ef8f97]',
      glow: 'before:bg-[radial-gradient(circle,_rgba(214,40,57,0.18)_0%,_transparent_68%)]',
    },
  },
  {
    title: 'Accès sécurisé',
    description: 'Les droits sont contrôlés par rôle pour protéger les actions sensibles.',
    icon: ShieldCheck,
    accent: {
      card: 'from-[#eef7ff] via-white to-[#f6fbff]',
      iconWrap: 'border-[#b8d9ff] bg-[#ecf6ff] shadow-[0_10px_22px_rgba(42,104,173,0.14)]',
      icon: 'text-[#1b5fa7]',
      border: 'border-[#d9e8f8] hover:border-[#9dc5ef]',
      glow: 'before:bg-[radial-gradient(circle,_rgba(29,102,173,0.16)_0%,_transparent_68%)]',
    },
  },
];

const steps = [
  {
    title: '1. Réception',
    text: 'Le courrier est enregistré, référencé et indexé avec ses informations clés.',
    icon: ScanLine,
    accent: 'border-[#d9ecfb] bg-[linear-gradient(160deg,#ffffff_0%,#eff8ff_100%)] hover:border-[#8ccfff] [&_svg]:text-[#0f6fb5]',
  },
  {
    title: '2. Orientation',
    text: 'Le document est affecté à la bonne direction selon la nature du dossier.',
    icon: ArrowRight,
    accent: 'border-[#f5e1b4] bg-[linear-gradient(160deg,#ffffff_0%,#fff8e7_100%)] hover:border-[#efc14d] [&_svg]:text-[#d48c00]',
  },
  {
    title: '3. Traitement',
    text: 'La direction suit l\'instruction et marque l\'avancement au fil des actions.',
    icon: Clock3,
    accent: 'border-[#f3d1d1] bg-[linear-gradient(160deg,#ffffff_0%,#fff3f3_100%)] hover:border-[#e68c95] [&_svg]:text-[#cf2f3f]',
  },
  {
    title: '4. Clôture',
    text: 'Le retour est validé et l\'historique reste consultable pour audit et reporting.',
    icon: CheckCircle2,
    accent: 'border-[#d7e7f8] bg-[linear-gradient(160deg,#ffffff_0%,#f3f9ff_100%)] hover:border-[#91b9e3] [&_svg]:text-[#1f5e9f]',
  },
];

const highlights = [
  'Suivi temps reel',
  'Validation par role',
  'Trajectoire auditable',
];

const ICON_ACCENT_CLASS = 'text-slate-700';

export default function Home() {
  const { user, isLoading } = useAuth();
  const [importantNotifications, setImportantNotifications] = useState<HomeNotification[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  const greeting = useMemo(() => {
    if (!user) return 'Plateforme de gestion des courriers du FPS';
    return `Bienvenue ${user.fullname}`;
  }, [user]);

  useEffect(() => {
    const fetchImportantNotifications = async () => {
      if (!user) {
        setImportantNotifications([]);
        setCurrentSlide(0);
        return;
      }

      try {
        const response = await api.get('/notifications');
        const notifications = Array.isArray(response.data?.data) ? response.data.data : [];

        const prioritized = notifications
          .sort((a: HomeNotification, b: HomeNotification) => {
            if (a.is_read !== b.is_read) return Number(a.is_read) - Number(b.is_read);
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          })
          .slice(0, 5);

        setImportantNotifications(prioritized);
        setCurrentSlide(0);
      } catch {
        setImportantNotifications([]);
      }
    };

    fetchImportantNotifications();
  }, [user]);

  useEffect(() => {
    if (importantNotifications.length <= 1 || isCarouselPaused) return;

    const interval = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % importantNotifications.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, [importantNotifications, isCarouselPaused]);

  const activeNotification = importantNotifications[currentSlide] ?? null;

  const goToPreviousSlide = () => {
    if (importantNotifications.length <= 1) return;
    setCurrentSlide((prev) => (prev - 1 + importantNotifications.length) % importantNotifications.length);
  };

  const goToNextSlide = () => {
    if (importantNotifications.length <= 1) return;
    setCurrentSlide((prev) => (prev + 1) % importantNotifications.length);
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 md:px-8 md:py-8">
      <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-cyan-300/30 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-amber-200/35 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 -right-20 h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] [background-size:36px_36px]" />

      <div className="relative mx-auto w-full max-w-6xl space-y-6 md:space-y-8">
        <section className="card border-slate-300/70 bg-[linear-gradient(130deg,#ffffff_0%,#f8fbff_56%,#ebf5ff_100%)] p-4 md:p-5 shadow-[0_16px_30px_rgba(15,23,42,0.11)] fade-in-up">
          <div
            className="flex items-start justify-between gap-3"
            onMouseEnter={() => setIsCarouselPaused(true)}
            onMouseLeave={() => setIsCarouselPaused(false)}
            onFocusCapture={() => setIsCarouselPaused(true)}
            onBlurCapture={(event) => {
              const nextFocused = event.relatedTarget as Node | null;
              if (!event.currentTarget.contains(nextFocused)) {
                setIsCarouselPaused(false);
              }
            }}
          >
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/60 bg-cyan-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-800">
                <Megaphone size={14} className={ICON_ACCENT_CLASS} />
                Notifications importantes
              </p>

              {!user ? (
                <p className="mt-3 text-sm text-slate-700">
                  Connectez-vous pour voir vos alertes prioritaires liées aux courriers.
                </p>
              ) : activeNotification ? (
                <div className="mt-3 space-y-1">
                  <p className="text-sm font-semibold text-slate-900 md:text-base">{activeNotification.message}</p>
                  <p className="text-xs text-slate-700">
                    {activeNotification.reference ? `${activeNotification.reference} - ` : ''}
                    {activeNotification.objet || 'Notification système'}
                  </p>
                  <div className="pt-1">
                    <Link
                      href={activeNotification.courrier_id ? `/courriers/${activeNotification.courrier_id}` : '/notifications'}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-900"
                    >
                        Ouvrir l&apos;alerte
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-700">
                  Aucune alerte prioritaire pour le moment.
                </p>
              )}
            </div>

            {importantNotifications.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToPreviousSlide}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-cyan-50"
                  aria-label="Notification précédente"
                >
                  <ChevronLeft size={16} className={ICON_ACCENT_CLASS} />
                </button>
                <button
                  type="button"
                  onClick={goToNextSlide}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-cyan-50"
                  aria-label="Notification suivante"
                >
                  <ChevronRight size={16} className={ICON_ACCENT_CLASS} />
                </button>
              </div>
            )}
          </div>

          {importantNotifications.length > 1 && (
            <div className="mt-3 flex items-center gap-1.5">
              {importantNotifications.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all ${index === currentSlide ? 'w-6 bg-slate-700' : 'w-2 bg-slate-400/70'}`}
                  aria-label={`Aller à la notification ${index + 1}`}
                />
              ))}
            </div>
          )}
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-slate-700/25 bg-[radial-gradient(circle_at_22%_8%,rgba(253,224,71,0.2),transparent_30%),linear-gradient(128deg,#0f172a_0%,#13384d_45%,#1f6f78_100%)] p-5 md:p-8 shadow-[0_20px_48px_rgba(15,23,42,0.3)] fade-in-up">
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-56 w-56 rounded-full bg-amber-100/10 blur-2xl" />
          <div className="grid gap-6 md:grid-cols-[1.3fr_0.7fr] md:items-center">
            <div>
              <p className="inline-flex items-center rounded-full border border-cyan-100/45 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-100">
                GED FPS
              </p>
              <h1 className="mt-3 text-3xl font-black leading-tight text-white md:text-5xl">
                Un accueil unique pour piloter le cycle de vie des courriers
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-200 md:text-base">
                {greeting}. Suivez chaque dossier, réduisez les délais de traitement et maintenez une gouvernance claire entre réception, directions et validation finale.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {highlights.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {user ? (
                  <>
                    <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-amber-200 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-100">
                      Ouvrir le dashboard
                      <ArrowRight size={16} />
                    </Link>
                    <Link href="/courriers" className="inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/10 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/20">
                      Voir les courriers
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      aria-busy={isLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-200 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-100"
                    >
                      {isLoading && (
                        <span
                          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-700 border-t-transparent"
                          aria-hidden="true"
                        />
                      )}
                      Se connecter
                      <ArrowRight size={16} />
                    </Link>
                    {isLoading && (
                      <span className="inline-flex items-center rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-slate-100">
                        Vérification de session...
                      </span>
                    )}
                    <a
                      href="#apercu"
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById('apercu')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/10 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/20 cursor-pointer"
                    >
                      Aperçu de la plateforme
                    </a>
                  </>
                )}
              </div>
            </div>

            <div className="card border-slate-300/80 bg-[linear-gradient(165deg,#ffffff_0%,#f5fbff_70%,#eef8ff_100%)] p-5 shadow-[0_16px_30px_rgba(15,23,42,0.2)]">
              <div className="mx-auto mb-3 h-16 w-16 md:h-20 md:w-20">
                <Image
                  src="/logo-fps.png"
                  alt="Logo FPS"
                  width={80}
                  height={80}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>
              <h2 className="text-center text-lg font-bold text-slate-900">Fonds de Promotion de la Santé</h2>
              <p className="mt-2 text-center text-sm text-slate-600">
                Gestion électronique des documents et courriers administratifs.
              </p>
              <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50/65 p-3 text-xs text-slate-700">
                Conseil: utilisez le dashboard pour visualiser les urgences et prioriser les actions du jour.
              </div>
            </div>
          </div>
        </section>

        <section id="apercu" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 scroll-mt-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className={`card stat-card group relative overflow-hidden rounded-[28px] ${feature.accent.border} bg-gradient-to-br ${feature.accent.card} p-4 md:p-5 shadow-[0_18px_34px_rgba(15,23,42,0.08)] fade-in-up transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_38px_rgba(15,23,42,0.12)] before:pointer-events-none before:absolute before:-right-12 before:-top-12 before:h-36 before:w-36 before:rounded-full before:opacity-90 before:blur-2xl ${feature.accent.glow}`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className={`inline-flex rounded-2xl border p-2.5 ${feature.accent.iconWrap}`}>
                  <Icon size={18} className={feature.accent.icon} />
                </div>
                <h3 className="mt-3 text-[1.15rem] font-black leading-tight text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-8 text-slate-700 md:text-[15px]">{feature.description}</p>
              </article>
            );
          })}
        </section>

        <section className="card rounded-[34px] border border-[#dce8f6] bg-[linear-gradient(145deg,#ffffff_0%,#f4f9ff_58%,#fffaf0_100%)] p-5 md:p-7 shadow-[0_20px_44px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Parcours courrier standard</h2>
              <p className="mt-1 text-sm text-slate-700">Un processus simple, visible et mesurable pour toutes les directions.</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className={`rounded-[26px] border p-4 shadow-[0_10px_22px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.1)] ${step.accent}`}>
                  <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Icon size={16} />
                    {step.title}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{step.text}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
