'use client';

import { ArrowLeft, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Veuillez saisir votre adresse email');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email: email.trim() });
      toast.success(response.data?.message || 'Si un compte existe, un email a été envoyé.');
      setEmail('');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Impossible de traiter votre demande pour le moment');
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
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Mot de passe oublié</h1>
          <p className="text-slate-600 text-sm mt-2">
            Saisissez votre adresse email. Si un compte existe, un lien de réinitialisation vous sera envoyé.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label" htmlFor="email">Adresse email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="input pl-9"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : null}
            {isLoading ? 'Envoi...' : 'Envoyer le lien'}
          </button>
        </form>
      </div>
    </div>
  );
}