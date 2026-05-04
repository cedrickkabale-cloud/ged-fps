'use client';

import { KeyRound, RefreshCcw, Save, ShieldCheck, UserCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { OcrJob, OcrMetrics } from '../../types';

export default function ParametresPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, markPasswordUpdated } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [ocrMetrics, setOcrMetrics] = useState<OcrMetrics | null>(null);
  const [ocrJobs, setOcrJobs] = useState<OcrJob[]>([]);
  const [ocrTopErrors, setOcrTopErrors] = useState<Array<{ error: string; count: number }>>([]);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<number | null>(null);
  const [forcePasswordChangeFromUrl, setForcePasswordChangeFromUrl] = useState(false);
  const mustChangePassword = Boolean(user?.mustChangePassword || user?.must_change_password);
  const forcePasswordChange = forcePasswordChangeFromUrl || mustChangePassword;
  const isAdmin = (user?.role || user?.role_name) === 'ADMIN';

  const redirectAccessDenied = (action: string) => {
    router.replace(`/acces-refuse?action=${action}&from=%2Fparametres`);
  };

  // Redirection conditionnelle à l'état d'authentification.
  useEffect(() => {
    if (!isAuthLoading && !user) {
      redirectAccessDenied('manage_settings');
    }
  }, [isAuthLoading, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setForcePasswordChangeFromUrl(params.get('forcePasswordChange') === '1');
  }, []);

  const fetchOcrDashboard = async () => {
    if (!isAdmin) return;
    setIsOcrLoading(true);
    try {
      const [metricsRes, jobsRes] = await Promise.all([
        api.get('/ocr/metrics'),
        api.get('/ocr/jobs?status=FAILED&limit=20&page=1'),
      ]);

      setOcrMetrics(metricsRes.data?.metrics || null);
      setOcrTopErrors(metricsRes.data?.topErrors || []);
      setOcrJobs(jobsRes.data?.data || []);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('ocr_supervision');
        return;
      }
      toast.error('Impossible de charger la supervision OCR');
    } finally {
      setIsOcrLoading(false);
    }
  };

  // Chargement OCR volontaire quand les prérequis d'accès sont réunis.
  useEffect(() => {
    if (!isAuthLoading && isAdmin) {
      void fetchOcrDashboard();
    }
  }, [isAuthLoading, isAdmin]);

  const retryOneJob = async (jobId: number) => {
    setRetryingJobId(jobId);
    try {
      const res = await api.post(`/ocr/jobs/${jobId}/retry`);
      toast.success(res.data?.message || 'Job OCR relancé');
      await fetchOcrDashboard();
    } catch {
      toast.error('Échec de relance du job OCR');
    } finally {
      setRetryingJobId(null);
    }
  };

  const retryAllFailedJobs = async () => {
    setIsRetryingAll(true);
    try {
      const res = await api.post('/ocr/jobs/retry-failed');
      toast.success(res.data?.message || 'Jobs OCR relancés');
      await fetchOcrDashboard();
    } catch {
      toast.error('Échec de relance des jobs OCR');
    } finally {
      setIsRetryingAll(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Tous les champs du mot de passe sont obligatoires');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('La confirmation ne correspond pas au nouveau mot de passe');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      markPasswordUpdated();
      toast.success('Mot de passe modifié avec succès');
      if (forcePasswordChangeFromUrl) {
        router.replace('/dashboard');
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('change_password');
        return;
      }
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Erreur lors de la modification du mot de passe');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Paramètres" subtitle="Gérez votre profil et votre sécurité" />

        <main className="flex-1 overflow-y-auto p-4 md:p-5 lg:p-6 space-y-6">
          <section className="card bg-[linear-gradient(115deg,#0f3f8a_0%,#0d5cbf_45%,#0d8e76_100%)] text-white border-none shadow-[0_18px_45px_rgba(11,72,149,0.28)]">
            <p className="text-xs uppercase tracking-[0.16em] text-white/80">Compte utilisateur</p>
            <h2 className="text-2xl mt-1 font-black">Paramètres personnels</h2>
              <p className="text-sm text-white/90 mt-1">Mettez à jour vos informations de sécurité pour protéger l&apos;accès à votre compte.</p>
          </section>

          {forcePasswordChange && (
            <section className="card border border-amber-200 bg-amber-50">
              <h3 className="font-semibold text-amber-900">Changement de mot de passe requis</h3>
              <p className="text-sm text-amber-800 mt-1">
                  Votre compte vient d&apos;être créé. Pour continuer à utiliser l&apos;application, changez votre mot de passe maintenant.
              </p>
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <section className="card lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <UserCircle2 size={20} className="text-blue-700" />
                <h3 className="font-semibold text-slate-900">Profil</h3>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-500">Nom complet</p>
                  <p className="font-semibold text-slate-900">{user?.fullname || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="font-semibold text-slate-900">{user?.email || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Rôle</p>
                  <p className="font-semibold text-slate-900">{user?.role || user?.role_name || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Direction</p>
                  <p className="font-semibold text-slate-900">{user?.direction_name || 'Non assignée'}</p>
                </div>
              </div>
            </section>

            <section className="card lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck size={20} className="text-emerald-700" />
                <h3 className="font-semibold text-slate-900">Sécurité du compte</h3>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="label">Mot de passe actuel</label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="input pl-9"
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Nouveau mot de passe</label>
                    <div className="relative">
                      <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input pl-9"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Confirmer le mot de passe</label>
                    <div className="relative">
                      <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input pl-9"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-primary inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Save size={16} />
                  {isSaving ? 'Mise à jour...' : 'Changer le mot de passe'}
                </button>
              </form>
            </section>
          </div>

          {isAdmin && (
            <section className="card border border-slate-200">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">Supervision OCR</h3>
                  <p className="text-xs text-slate-500 mt-1">Jobs en file, échecs et relance manuelle.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void fetchOcrDashboard()}
                    disabled={isOcrLoading}
                    className="btn-secondary inline-flex items-center gap-1.5 text-xs"
                  >
                    <RefreshCcw size={14} />
                    Actualiser
                  </button>
                  <button
                    onClick={retryAllFailedJobs}
                    disabled={isRetryingAll || (ocrMetrics?.failedJobs || 0) === 0}
                    className="btn-primary inline-flex items-center gap-1.5 text-xs disabled:opacity-60"
                  >
                    {isRetryingAll ? 'Relance...' : 'Relancer tous les FAILED'}
                  </button>
                </div>
              </div>

              {isOcrLoading ? (
                <div className="animate-pulse space-y-2">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-9 bg-slate-100 rounded" />)}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
                    <div className="rounded-lg border border-slate-200 p-2"><p className="text-[11px] text-slate-500">Total</p><p className="font-semibold">{ocrMetrics?.totalJobs ?? 0}</p></div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2"><p className="text-[11px] text-amber-700">Pending</p><p className="font-semibold text-amber-900">{ocrMetrics?.pendingJobs ?? 0}</p></div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-2"><p className="text-[11px] text-blue-700">Processing</p><p className="font-semibold text-blue-900">{ocrMetrics?.processingJobs ?? 0}</p></div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-2"><p className="text-[11px] text-red-700">Failed</p><p className="font-semibold text-red-900">{ocrMetrics?.failedJobs ?? 0}</p></div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2"><p className="text-[11px] text-emerald-700">Done</p><p className="font-semibold text-emerald-900">{ocrMetrics?.doneJobs ?? 0}</p></div>
                    <div className="rounded-lg border border-slate-200 p-2"><p className="text-[11px] text-slate-500">Durée moyenne</p><p className="font-semibold">{ocrMetrics?.avgProcessingMs ?? 0} ms</p></div>
                    <div className="rounded-lg border border-slate-200 p-2"><p className="text-[11px] text-slate-500">Taux échec</p><p className="font-semibold">{ocrMetrics?.failureRate ?? 0}%</p></div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 mb-2">Top erreurs OCR</h4>
                      {ocrTopErrors.length === 0 ? (
                        <p className="text-xs text-slate-500">Aucune erreur recensée.</p>
                      ) : (
                        <ul className="space-y-2">
                          {ocrTopErrors.map((item, idx) => (
                            <li key={`${item.error}-${idx}`} className="rounded-lg border border-slate-200 p-2">
                              <p className="text-xs font-medium text-slate-700">{item.error}</p>
                              <p className="text-[11px] text-slate-500 mt-1">{item.count} occurrence(s)</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 mb-2">Jobs FAILED récents</h4>
                      {ocrJobs.length === 0 ? (
                        <p className="text-xs text-slate-500">Aucun job en échec.</p>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {ocrJobs.map((job) => (
                            <div key={job.id} className="rounded-lg border border-red-200 bg-red-50 p-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-red-900">Job #{job.id} · PJ #{job.piece_jointe_id}</p>
                                <button
                                  onClick={() => void retryOneJob(job.id)}
                                  disabled={retryingJobId === job.id}
                                  className="text-[11px] px-2 py-1 rounded bg-white border border-red-200 text-red-700 hover:bg-red-100 disabled:opacity-60"
                                >
                                  {retryingJobId === job.id ? 'Relance...' : 'Relancer'}
                                </button>
                              </div>
                              <p className="text-[11px] text-red-700 mt-1 truncate">{job.file_name || 'Fichier inconnu'} · {job.courrier_reference || 'sans ref'}</p>
                              <p className="text-[11px] text-red-800 mt-1 line-clamp-2">{job.last_error || 'Erreur non détaillée'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
