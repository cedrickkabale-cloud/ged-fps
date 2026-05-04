'use client';

import { ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toastProbe, setToastProbe] = useState<{ kind: 'success' | 'error'; message: string; tick: number } | null>(null);
  const { login } = useAuth();
  const router = useRouter();

  const emitToast = (kind: 'success' | 'error', message: string) => {
    if (kind === 'success') {
      toast.success(message);
    } else {
      toast.error(message);
    }

    // Sonde DOM invisible pour les tests E2E/UI (sans impact visuel utilisateur)
    setToastProbe({ kind, message, tick: Date.now() });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      emitToast('error', 'Veuillez remplir tous les champs');
      return;
    }

    setIsLoading(true);
    try {
      const loggedUser = await login(email, password);
      emitToast('success', 'Connexion réussie');
      const mustChangePassword = Boolean(loggedUser.mustChangePassword || loggedUser.must_change_password);
      router.push(mustChangePassword ? '/parametres?forcePasswordChange=1' : '/dashboard');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Identifiants incorrects';
      emitToast('error', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 bg-[radial-gradient(circle_at_12%_8%,#d9e7ff_0,transparent_38%),radial-gradient(circle_at_88%_0%,#d8f0ea_0,transparent_34%),linear-gradient(160deg,#f7fbff_0%,#edf3fb_100%)]">
      <div
        className="sr-only"
        role={toastProbe?.kind === 'error' ? 'alert' : 'status'}
        aria-live={toastProbe?.kind === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
        data-testid="login-toast-probe"
        data-toast-kind={toastProbe?.kind || ''}
        data-toast-tick={toastProbe?.tick || 0}
      >
        {toastProbe?.message || ''}
      </div>

      <div className="absolute -top-20 -left-24 w-72 h-72 rounded-full bg-blue-300/30 blur-3xl" />
      <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-teal-300/30 blur-3xl" />

      <div className="relative glass rounded-3xl w-full max-w-md p-6 sm:p-8 fade-in-up">
        {/* Retour à l'accueil */}
        <Link
          href="/#apercu"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition mb-4"
        >
          <ArrowLeft size={13} />
          Retour à l&apos;accueil
        </Link>

        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-16 sm:w-20 h-16 sm:h-20 mx-auto mb-3 sm:mb-4">
            <Image src="/logo-fps.png" alt="Logo FPS" width={80} height={80} className="object-contain w-full h-full" priority />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">GED FPS</h1>
          <p className="text-slate-600 text-sm mt-1">Gestion Électronique Des Documents</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
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
                autoComplete="username"
                required
              />
            </div>
          </div>

          {/* Mot de passe */}
          <div>
            <label className="label" htmlFor="password">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input pl-9 pr-10"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="mt-2 text-right">
              <Link
                href="/mot-de-passe-oublie"
                className="text-sm font-medium text-blue-700 hover:text-blue-900 transition"
              >
                Mot de passe oublié ?
              </Link>
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
            {isLoading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          Fonds de Promotion de la Santé &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
