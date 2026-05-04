'use client';

import { AlertTriangle, ArrowLeft, Lock } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../contexts/AuthContext';

const ACTION_LABELS: Record<string, string> = {
  create_courrier: 'enregistrer un nouveau courrier',
  print_label: 'imprimer une étiquette',
  workflow_action: 'exécuter cette action de workflow',
  delete_attachment: 'supprimer une piece jointe',
  upload_attachment: 'ajouter une piece jointe',
  manage_users: 'consulter la gestion des utilisateurs',
  create_user: 'créer un utilisateur',
  update_user: 'modifier un utilisateur',
  toggle_user_status: 'modifier le statut d\'un utilisateur',
  reset_user_password: 'réinitialiser un mot de passe utilisateur',
  delete_user: 'supprimer un utilisateur',
  view_user_history: 'consulter l\'historique utilisateur',
  manage_directions: 'consulter la gestion des directions',
  create_direction: 'créer une direction',
  manage_notifications: 'consulter les notifications',
  mark_notification_read: 'marquer une notification comme lue',
  mark_all_notifications_read: 'marquer toutes les notifications comme lues',
  manage_settings: 'consulter les paramètres',
  change_password: 'modifier le mot de passe',
};

const PAGE_LABELS: Record<string, string> = {
  '/courriers/nouveau': 'Nouveau courrier',
  '/courriers': 'Courriers',
  '/utilisateurs': 'Gestion des utilisateurs',
  '/directions': 'Gestion des directions',
  '/notifications': 'Notifications',
  '/parametres': 'Paramètres',
  '/dashboard': 'Dashboard',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  DG: 'Directeur Général',
  DGA: 'Directeur Général Adjoint',
  SECRETAIRE_ADMIN: 'Secrétaire Administratif',
  SECRETAIRE_ADMIN_ADJ: 'Secrétaire Administratif Adjoint',
  SECRETAIRE_DG: 'Secrétaire du DG',
  SECRETAIRE_DGA: 'Secrétaire du DGA',
  DIRECTEUR: 'Directeur',
  SECRETAIRE_DIRECTION: 'Secrétaire de direction',
  COURRIER_ENTRANT: 'Chargé des courriers entrants',
  COURRIER_SORTANT: 'Chargé des courriers sortants',
};

const ACTION_FALLBACK_PATHS: Record<string, string> = {
  create_courrier: '/courriers',
  print_label: '/courriers',
  workflow_action: '/courriers',
  delete_attachment: '/courriers',
  upload_attachment: '/courriers',
  manage_users: '/utilisateurs',
  create_user: '/utilisateurs',
  update_user: '/utilisateurs',
  toggle_user_status: '/utilisateurs',
  reset_user_password: '/utilisateurs',
  delete_user: '/utilisateurs',
  view_user_history: '/utilisateurs',
  manage_directions: '/directions',
  create_direction: '/directions',
  manage_notifications: '/notifications',
  mark_notification_read: '/notifications',
  mark_all_notifications_read: '/notifications',
  manage_settings: '/parametres',
  change_password: '/parametres',
};

const ACTION_POLICY_HINTS: Record<string, string> = {
  manage_users: 'Cette section est réservée aux administrateurs.',
  create_user: 'La création de comptes est réservée aux administrateurs.',
  update_user: 'La modification de comptes est réservée aux administrateurs.',
  toggle_user_status: 'La gestion du statut des comptes est réservée aux administrateurs.',
  reset_user_password: 'La réinitialisation des mots de passe est réservée aux administrateurs.',
  delete_user: 'La suppression de comptes est réservée aux administrateurs.',
  view_user_history: 'La consultation de l\'historique utilisateur est réservée aux administrateurs.',
  manage_directions: 'La gestion des directions est réservée aux administrateurs.',
  create_direction: 'La création de directions est réservée aux administrateurs.',
};

const getSafeInternalPath = (path: string) => {
  if (!path || !path.startsWith('/')) return '';
  if (path.startsWith('//')) return '';
  return path;
};

export default function AccesRefusePage() {
  const { user, isLoading } = useAuth();
  const [action, setAction] = useState('');
  const [fromPath, setFromPath] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAction(params.get('action') || '');
    setFromPath(params.get('from') || '');
  }, []);

  const actionLabel = useMemo(() => {
    return ACTION_LABELS[action] || 'exécuter cette action';
  }, [action]);

  const safeOriginPath = useMemo(() => getSafeInternalPath(fromPath), [fromPath]);

  const fromLabel = useMemo(() => {
    return PAGE_LABELS[safeOriginPath] || safeOriginPath || 'la page demandée';
  }, [safeOriginPath]);

  const normalizedRole = useMemo(
    () => (user?.role || user?.role_name || '').toUpperCase().replace(/\s+/g, '_'),
    [user?.role, user?.role_name]
  );

  const roleLabel = useMemo(() => {
    if (!normalizedRole) return 'votre profil';
    return ROLE_LABELS[normalizedRole] || user?.role || user?.role_name || 'votre profil';
  }, [normalizedRole, user?.role, user?.role_name]);

  const policyHint = useMemo(() => {
    return ACTION_POLICY_HINTS[action] || 'Si vous pensez que cet accès est légitime, contactez un administrateur.';
  }, [action]);

  const returnHref = useMemo(() => {
    return safeOriginPath || ACTION_FALLBACK_PATHS[action] || '/dashboard';
  }, [action, safeOriginPath]);

  const returnLabel = useMemo(() => {
    const targetLabel = PAGE_LABELS[returnHref] || 'la page précédente';
    return `Retour vers ${targetLabel}`;
  }, [returnHref]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 text-center space-y-4 shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
            <Lock size={20} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Accès refusé</h1>
          <p className="text-sm text-slate-600">
            Vous devez vous connecter pour accéder à cette ressource.
          </p>
          <Link href="/login" className="btn-primary inline-flex items-center gap-2">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Accès refusé" subtitle="Vous n'avez pas les autorisations nécessaires" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-2xl card border border-red-200 bg-red-50/60">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-red-800">Action non autorisée</h2>
                <p className="text-sm text-red-700 mt-1">
                  Le rôle {roleLabel} ne peut pas {actionLabel}.
                </p>
                <p className="text-xs text-red-700/90 mt-2">{policyHint}</p>
                <p className="text-xs text-red-700/90 mt-2">
                  Origine: {fromLabel}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={returnHref} className="btn-secondary inline-flex items-center gap-2">
                <ArrowLeft size={14} />
                {returnLabel}
              </Link>
              <Link href="/dashboard" className="btn-primary inline-flex items-center gap-2">
                Aller au Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
