'use client';

import { clsx } from 'clsx';
import {
    ArrowDownToLine,
    CheckCircle,
    Clock,
    FileDown,
    Mail,
    Plus,
    Sheet,
    TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import CourriersTable from '../../components/CourriersTable';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useExport } from '../../hooks/useExport';
import api from '../../lib/api';
import { Courrier, ROLES_RECEPTION_COURRIERS, STATUT_LABELS, StatutCourrier } from '../../types';

interface Stats {
  total_entrants: string;
  total_sortants: string;
  en_attente: string;
  en_cours: string;
  traites: string;
  recu_aujourd_hui: string;
}

interface StatutCount { statut: string; count: string; }
interface DirectionCount { name: string; count: string; }
interface MoisCount { mois: string; entrants: string; sortants: string; }

const CHART_COLORS = [
  '#1c64d1', '#0d8e76', '#d97706', '#7c3aed',
  '#db2777', '#0891b2', '#65a30d', '#dc2626',
];

const StatCard = ({
  title, value, icon: Icon, color, subtitle,
}: {
  title: string; value: string | number; icon: React.ElementType; color: string; subtitle?: string;
}) => (
  <div className="card stat-card fade-in-up flex items-start gap-4">
    <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
      <Icon size={22} className="text-white" />
    </div>
    <div>
      <p className="text-xl md:text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

const formatMois = (mois: string) => {
  const [year, month] = mois.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [parStatut, setParStatut] = useState<StatutCount[]>([]);
  const [parDirection, setParDirection] = useState<DirectionCount[]>([]);
  const [evolutionMensuelle, setEvolutionMensuelle] = useState<MoisCount[]>([]);
  const [recentCourriers, setRecentCourriers] = useState<Courrier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const { exportExcel, exportPdf } = useExport();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, courriersRes] = await Promise.all([
          api.get('/courriers/stats'),
          api.get('/courriers?limit=10'),
        ]);
        setStats(statsRes.data.stats);
        setParStatut(statsRes.data.parStatut || []);
        setParDirection(statsRes.data.parDirection || []);
        setEvolutionMensuelle(statsRes.data.evolutionMensuelle || []);
        setRecentCourriers(courriersRes.data.data);
      } catch (err) {
        console.error('Erreur chargement dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleExportRecentPdf = () => exportPdf(recentCourriers, 'courriers_recents', 'Courriers récents');
  const handleExportRecentExcel = () => exportExcel(recentCourriers, 'courriers_recents');

  const handleExportGlobal = async (type: 'pdf' | 'excel') => {
    setIsExporting(true);
    try {
      const res = await api.get('/courriers?limit=10000');
      const all: Courrier[] = res.data.data;
      if (type === 'pdf') {
        await exportPdf(all, 'courriers_global', 'Vue globale — Tous les courriers');
      } else {
        await exportExcel(all, 'courriers_global');
      }
    } catch {
      toast.error('Erreur lors de l\'export global');
    } finally {
      setIsExporting(false);
    }
  };

  // Préparer les données du camembert (top 8 statuts non vides)
  const pieData = parStatut
    .filter(s => parseInt(s.count) > 0)
    .slice(0, 8)
    .map(s => ({
      name: STATUT_LABELS[s.statut as StatutCourrier] ?? s.statut,
      value: parseInt(s.count),
    }));

  // Préparer les données barres directions (top 8)
  const dirData = parDirection
    .filter(d => parseInt(d.count) > 0)
    .slice(0, 8)
    .map(d => ({ name: d.name.length > 12 ? d.name.slice(0, 12) + '…' : d.name, fullName: d.name, count: parseInt(d.count) }));

  const mensuelData = evolutionMensuelle.map(m => ({
    mois: formatMois(m.mois),
    Entrants: parseInt(m.entrants),
    Sortants: parseInt(m.sortants),
  }));

  const canCreateCourrier = user?.role ? ROLES_RECEPTION_COURRIERS.includes(user.role) : false;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Dashboard" subtitle="Vue d'ensemble des courriers GED FPS" />

        <main className="flex-1 overflow-y-auto p-4 md:p-5 lg:p-6 space-y-6">
          {/* Bannière */}
          <section className="card bg-[linear-gradient(115deg,#0f3f8a_0%,#0d5cbf_45%,#0d8e76_100%)] text-white border-none shadow-[0_18px_45px_rgba(11,72,149,0.28)] fade-in-up">
            <p className="text-xs uppercase tracking-[0.16em] text-white/80">Vue Exécutive</p>
            <h2 className="text-xl md:text-2xl lg:text-3xl mt-1 font-black">Pilotage Intelligent Du Circuit Des Courriers</h2>
            <p className="text-sm text-white/90 mt-2 max-w-2xl">
              Suivez en temps réel les flux entrants et sortants, avec une traçabilité complète et une visibilité immédiate des actions prioritaires.
            </p>
          </section>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Courriers entrants" value={stats?.total_entrants ?? '—'} icon={ArrowDownToLine} color="bg-[linear-gradient(135deg,#1c64d1,#1fa4d4)]" subtitle="Total" />
            <StatCard title="En attente" value={stats?.en_attente ?? '—'} icon={Clock} color="bg-[linear-gradient(135deg,#d97706,#f59e0b)]" subtitle="À traiter" />
            <StatCard title="En cours" value={stats?.en_cours ?? '—'} icon={TrendingUp} color="bg-[linear-gradient(135deg,#0d8e76,#16a34a)]" subtitle="En circuit" />
            <StatCard title="Traités" value={stats?.traites ?? '—'} icon={CheckCircle} color="bg-[linear-gradient(135deg,#0f3f8a,#0b5bd3)]" subtitle="Finalisés" />
          </div>

          {/* Aujourd'hui + actions rapides */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card fade-in-up flex items-center gap-4 lg:col-span-1">
              <div className="w-12 h-12 rounded-xl bg-[linear-gradient(135deg,#0b5bd3,#0d8e76)] flex items-center justify-center">
                <Mail size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold text-slate-900">{stats?.recu_aujourd_hui ?? '—'}</p>
                <p className="text-sm text-slate-600">Reçus aujourd&apos;hui</p>
              </div>
              {canCreateCourrier && (
                <Link href="/courriers/nouveau" className="btn-primary flex items-center gap-1.5">
                  <Plus size={16} />
                  Nouveau
                </Link>
              )}
            </div>
            <div className="card fade-in-up lg:col-span-2">
              <h3 className="font-semibold text-slate-900 mb-1 text-sm">Actions rapides</h3>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link href="/courriers?statut=RECU" className="btn-secondary text-xs">Courriers reçus</Link>
                <Link href="/courriers?statut=ORIENTE" className="btn-secondary text-xs">À orienter</Link>
                <Link href="/courriers?statut=RETOUR" className="btn-secondary text-xs">En retour</Link>
                <Link href="/courriers?statut=SORTANT_ENREGISTRE" className="btn-secondary text-xs">Sortants à confirmer</Link>
              </div>
            </div>
          </div>

          {/* ── GRAPHIQUES ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* Évolution mensuelle */}
            <div className="card fade-in-up xl:col-span-2">
              <h2 className="font-semibold text-slate-900 mb-4">Évolution mensuelle (12 derniers mois)</h2>
              {mensuelData.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Pas encore de données</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={mensuelData} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Entrants" fill="#1c64d1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Sortants" fill="#0d8e76" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Répartition par statut */}
            <div className="card fade-in-up">
              <h2 className="font-semibold text-slate-900 mb-4">Répartition par statut</h2>
              {pieData.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Pas encore de données</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                      formatter={(value: number, name: string) => [value, name]}
                    />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      wrapperStyle={{ fontSize: '11px', lineHeight: '20px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Courriers par direction */}
            <div className="card fade-in-up">
              <h2 className="font-semibold text-slate-900 mb-4">Courriers par direction</h2>
              {dirData.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Pas encore de données</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dirData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={80} />
                    <Tooltip
                      contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                      formatter={(value: number, _: string, props) => [value, props.payload.fullName]}
                    />
                    <Bar dataKey="count" name="Courriers" radius={[0, 4, 4, 0]}>
                      {dirData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Tableau récents */}
          <div className="card fade-in-up">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <h2 className="font-semibold text-slate-900">Courriers récents</h2>
              <div className="flex items-center gap-2 flex-wrap mt-2 sm:mt-0">
                <span className="text-xs text-slate-500 font-medium">Vue restreinte :</span>
                <button onClick={handleExportRecentPdf} disabled={isLoading || recentCourriers.length === 0} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3">
                  <FileDown size={14} />PDF
                </button>
                <button onClick={handleExportRecentExcel} disabled={isLoading || recentCourriers.length === 0} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3">
                  <Sheet size={14} />Excel
                </button>
                <span className="text-xs text-slate-500 font-medium ml-2">Vue globale :</span>
                <button onClick={() => handleExportGlobal('pdf')} disabled={isExporting} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3">
                  {isExporting ? <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <FileDown size={14} />}
                  PDF (tout)
                </button>
                <button onClick={() => handleExportGlobal('excel')} disabled={isExporting} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3">
                  {isExporting ? <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Sheet size={14} />}
                  Excel (tout)
                </button>
                <Link href="/courriers" className="text-sm text-blue-700 hover:underline ml-2">Voir tout →</Link>
              </div>
            </div>
            <CourriersTable courriers={recentCourriers} isLoading={isLoading} />
          </div>
        </main>
      </div>
    </div>
  );
}
