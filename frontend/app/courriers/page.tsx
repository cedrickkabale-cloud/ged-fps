'use client';

import { FileDown, Filter, Plus, RefreshCw, Search, Sheet, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import CourriersTable from '../../components/CourriersTable';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useExport } from '../../hooks/useExport';
import api from '../../lib/api';
import { Courrier, ROLES_RECEPTION_COURRIERS, STATUT_LABELS, StatutCourrier } from '../../types';

const STATUTS = Object.keys(STATUT_LABELS) as StatutCourrier[];

export default function CourriersPage() {
  const { user } = useAuth();
  const [courriers, setCourriers] = useState<Courrier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const limit = 20;
  const { exportExcel, exportPdf } = useExport();

  useEffect(() => {
    const initialStatut = new URLSearchParams(window.location.search).get('statut') || '';
    if (initialStatut) {
      setStatut(initialStatut);
    }
  }, []);

  const fetchCourriers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statut) params.append('statut', statut);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const res = await api.get(`/courriers?${params.toString()}`);
      setCourriers(res.data.data);
      setTotal(res.data.pagination.total);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [search, statut, page]);

  useEffect(() => {
    fetchCourriers();
  }, [fetchCourriers]);

  const totalPages = Math.ceil(total / limit);

  // Export de la vue courante (page en cours avec filtres)
  const fileBase = statut ? `courriers_${statut.toLowerCase()}` : 'courriers_liste';
  const pdfTitle = statut ? `Courriers — ${STATUT_LABELS[statut as StatutCourrier] ?? statut}` : 'Liste des courriers';
  const handleExportCurrentPdf = () => exportPdf(courriers, fileBase, pdfTitle);
  const handleExportCurrentExcel = () => exportExcel(courriers, fileBase);

  // Export global (tous les courriers selon filtres actifs)
  const handleExportAllFiltered = async (type: 'pdf' | 'excel') => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statut) params.append('statut', statut);
      params.append('limit', '10000');
      const res = await api.get(`/courriers?${params.toString()}`);
      const all: Courrier[] = res.data.data;
      if (type === 'pdf') {
        await exportPdf(all, fileBase + '_complet', pdfTitle + ' (complet)');
      } else {
        await exportExcel(all, fileBase + '_complet');
      }
    } catch {
      toast.error('Erreur lors de l\'export');
    } finally {
      setIsExporting(false);
    }
  };

  const canCreateCourrier = user?.role ? ROLES_RECEPTION_COURRIERS.includes(user.role) : false;
  const isAdmin = (user?.role || user?.role_name) === 'ADMIN';

  const handleDeleteAllCourriers = async () => {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      'Supprimer TOUS les courriers ?\n\nCette action est irréversible et supprimera aussi toutes les pièces jointes.\n\nCliquez OK pour continuer, puis saisissez le mot de confirmation.'
    );
    if (!confirmed) return;

    const saisie = window.prompt(
      'Pour confirmer, tapez exactement : SUPPRIMER'
    );
    if (saisie === null) return; // annulé
    if (saisie.trim() !== 'SUPPRIMER') {
      toast.error('Suppression annulée — mot de confirmation incorrect.');
      return;
    }

    setIsDeletingAll(true);
    try {
      const res = await api.delete('/courriers/bulk/all');
      toast.success(res.data?.message || 'Tous les courriers ont été supprimés');
      setPage(1);
      await fetchCourriers();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Erreur lors de la suppression globale';
      toast.error(msg);
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Courriers" subtitle={`${total} courrier${total > 1 ? 's' : ''} au total`} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">
          <section className="card fade-in-up bg-[linear-gradient(120deg,#0f3f8a_0%,#0b5bd3_48%,#0d8e76_100%)] border-none text-white">
            <p className="text-xs uppercase tracking-[0.16em] text-white/80">Centre De Suivi</p>
            <h2 className="text-xl md:text-2xl lg:text-3xl font-black mt-1">Pilotage Opérationnel Des Courriers</h2>
            <p className="text-sm text-white/90 mt-2 max-w-2xl">
              Filtre rapidement les courriers par statut et garde une vue nette des actions urgentes.
            </p>
          </section>

          {/* Filtres */}
          <div className="card fade-in-up">
            <div className="flex flex-wrap gap-3">
              {/* Recherche */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Référence, n° entrant/sortant, objet, expéditeur..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="input pl-9"
                />
              </div>

              {/* Filtre statut */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select
                  value={statut}
                  onChange={(e) => { setStatut(e.target.value); setPage(1); }}
                  className="input pl-9 pr-8 appearance-none min-w-[180px]"
                >
                  <option value="">Tous les statuts</option>
                  {STATUTS.map((s) => (
                    <option key={s} value={s}>{STATUT_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              <button onClick={fetchCourriers} className="btn-secondary flex items-center gap-1.5">
                <RefreshCw size={14} />
                Actualiser
              </button>

              {/* Groupe export */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleExportCurrentPdf}
                  disabled={isLoading || courriers.length === 0}
                  className="btn-secondary flex items-center gap-1.5"
                  title="Exporter la page courante en PDF"
                >
                  <FileDown size={14} />
                  PDF
                </button>
                <button
                  onClick={handleExportCurrentExcel}
                  disabled={isLoading || courriers.length === 0}
                  className="btn-secondary flex items-center gap-1.5"
                  title="Exporter la page courante en Excel"
                >
                  <Sheet size={14} />
                  Excel
                </button>
                <button
                  onClick={() => handleExportAllFiltered('pdf')}
                  disabled={isExporting}
                  className="btn-secondary flex items-center gap-1.5"
                  title="Exporter tous les résultats filtrés en PDF"
                >
                  {isExporting ? (
                    <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FileDown size={14} />
                  )}
                  PDF (tout)
                </button>
                <button
                  onClick={() => handleExportAllFiltered('excel')}
                  disabled={isExporting}
                  className="btn-secondary flex items-center gap-1.5"
                  title="Exporter tous les résultats filtrés en Excel"
                >
                  {isExporting ? (
                    <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sheet size={14} />
                  )}
                  Excel (tout)
                </button>
              </div>

              {isAdmin && (
                <button
                  onClick={handleDeleteAllCourriers}
                  disabled={isDeletingAll}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Supprimer tous les courriers"
                >
                  {isDeletingAll ? (
                    <span className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Supprimer tous
                </button>
              )}

              {canCreateCourrier && (
                <Link href="/courriers/nouveau" className="btn-primary flex items-center gap-1.5">
                  <Plus size={14} />
                  Nouveau
                </Link>
              )}
            </div>
          </div>

          {/* Tableau */}
          <div className="card fade-in-up">
            <CourriersTable courriers={courriers} isLoading={isLoading} />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Page {page} sur {totalPages} — {total} résultat{total > 1 ? 's' : ''}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary text-xs disabled:opacity-40"
                  >
                    ← Précédent
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn-secondary text-xs disabled:opacity-40"
                  >
                    Suivant →
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
