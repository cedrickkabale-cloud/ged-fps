'use client';

import { ArrowLeft, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') || '');
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!token) {
      toast.error('Lien de réinitialisation invalide ou incomplet');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Le nouveau mot de passe doit contenir au moins 8 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('La confirmation ne correspond pas au mot de passe');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/reset-password', { token, newPassword });
      toast.success(response.data?.message || 'Mot de passe réinitialisé avec succès');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Impossible de réinitialiser le mot de passe');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 bg-[radial-gradient(circle_at_12%_8%,#d9e7ff_0,transparent_38%),radial-gradient(circle_at_88%_0%,#d8f0ea_0,transparent_34%),linear-gradient(160deg,#f7fbff_0%,#edf3fb_100%)]">
      <div className="absolute -top-20 -left-24 w-72 h-72 rounded-full bg-blue-300/30 blur-3xl" />
      <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-teal-300/30 blur-3xl" />

      <div className="relative glass rounded-3xl w-full max-w-md p-6 sm:p-8 fade-in-up">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition mb-4"
        >
          <ArrowLeft size={13} />
          Retour à la connexion
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Réinitialiser le mot de passe</h1>
          <p className="text-slate-600 text-sm mt-2">
            Choisissez un nouveau mot de passe sécurisé pour votre compte GED FPS.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label" htmlFor="new-password">Nouveau mot de passe</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input pl-9"
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="confirm-password">Confirmer le mot de passe</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input pl-9"
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !token}
            className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isLoading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : null}
            {isLoading ? 'Mise à jour...' : 'Définir le nouveau mot de passe'}
          </button>

          {!token ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Aucun jeton détecté dans le lien. Ouvrez le lien reçu par email.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}