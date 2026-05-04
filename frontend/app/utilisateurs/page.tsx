'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { History, KeyRound, Pencil, Plus, Trash2, UserCheck, UserX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ConfirmModal';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { User } from '../../types';

interface Role {
  id: number;
  name: string;
  description: string;
}

interface Direction {
  id: number;
  name: string;
  code?: string;
}

interface UserHistoryItem {
  id: number;
  action: string;
  created_at: string;
  ip_address?: string;
  actor_name?: string;
  actor_email?: string;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE_USER: 'Création du compte',
  UPDATE_USER: 'Modification du compte',
  RESET_USER_PASSWORD: 'Réinitialisation du mot de passe',
  SUSPEND_USER: 'Suspension du compte',
  ACTIVATE_USER: 'Réactivation du compte',
  DELETE_USER: 'Suppression définitive du compte',
  SOFT_DELETE_USER: 'Suppression (ancien mode désactivation)',
};

type HistoryActionFilter = 'ALL' | keyof typeof ACTION_LABELS;

const ASSISTANT_ROLE_NAMES = new Set([
  'ASSISTANT_TECHNIQUE',
  'ASSISTANT_JURIDIQUE',
  'ASSISTANT_FINANCIER',
]);

export default function UtilisateursPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [processingUserId, setProcessingUserId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [historyUser, setHistoryUser] = useState<User | null>(null);
  const [historyItems, setHistoryItems] = useState<UserHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyActionFilter, setHistoryActionFilter] = useState<HistoryActionFilter>('ALL');

  // Modals état
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [resetModal, setResetModal] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [isCreating, setIsCreating] = useState(false);

  const [form, setForm] = useState({
    fullname: '', email: '', password: '', role_id: '', direction_id: '',
  });

  const [editForm, setEditForm] = useState({
    fullname: '', email: '', role_id: '', direction_id: '',
  });

  const redirectAccessDenied = (action: string) => {
    router.replace(`/acces-refuse?action=${action}&from=%2Futilisateurs`);
  };

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes, dirsRes] = await Promise.all([
        api.get('/users'),
        api.get('/users/roles'),
        api.get('/directions'),
      ]);
      setUsers(usersRes.data.data);
      setRoles(rolesRes.data.data);
      setDirections(dirsRes.data.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('manage_users');
        return;
      }
      toast.error('Erreur chargement');
    } finally {
      setIsLoading(false);
    }
  };

  // Chargement initial volontaire au montage de la page.
  useEffect(() => { fetchData(); }, []);

  const normalizeLabel = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

  const findDirectionGenerale = () => directions.find((d) => {
    const code = (d.code || '').toUpperCase();
    const name = normalizeLabel(d.name || '');
    return (
      code === 'DG' ||
      (name.includes('DIRECTION GENERALE') && !name.includes('ADJOINTE'))
    );
  });

  const getRoleNameById = (roleId: string) => roles.find((r) => String(r.id) === roleId)?.name || '';

  const directionGenerale = findDirectionGenerale();
  const isCreateAssistantRole = ASSISTANT_ROLE_NAMES.has(getRoleNameById(form.role_id));
  const isEditAssistantRole = ASSISTANT_ROLE_NAMES.has(getRoleNameById(editForm.role_id));

  useEffect(() => {
    if (!isCreateAssistantRole) return;
    setForm((prev) => ({
      ...prev,
      direction_id: directionGenerale ? String(directionGenerale.id) : '',
    }));
  }, [isCreateAssistantRole, directionGenerale]);

  useEffect(() => {
    if (!editingUser || !isEditAssistantRole) return;
    setEditForm((prev) => ({
      ...prev,
      direction_id: directionGenerale ? String(directionGenerale.id) : '',
    }));
  }, [editingUser, isEditAssistantRole, directionGenerale]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const response = await api.post('/users', {
        ...form,
        role_id: parseInt(form.role_id),
        direction_id: form.direction_id ? parseInt(form.direction_id) : undefined,
      });
      toast.success(response.data?.message || 'Utilisateur créé avec succès');
      setShowForm(false);
      setForm({ fullname: '', email: '', password: '', role_id: '', direction_id: '' });
      fetchData();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('create_user');
        return;
      }
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erreur';
      toast.error(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleActive = async (userId: number, isActive: boolean) => {
    setProcessingUserId(userId);
    try {
      await api.patch(`/users/${userId}/status`, {
        action: isActive ? 'suspend' : 'activate',
      });
      toast.success(isActive ? 'Utilisateur désactivé' : 'Utilisateur activé');
      await fetchData();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('toggle_user_status');
        return;
      }
      toast.error('Erreur');
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleResetPassword = async () => {
    const targetUser = resetModal.user;
    if (!targetUser) return;

    setResetModal({ open: false, user: null });
    setProcessingUserId(targetUser.id);
    try {
      const res = await api.post(`/users/${targetUser.id}/reset-password`);
      toast.success(res.data?.message || 'Mot de passe réinitialisé');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('reset_user_password');
        return;
      }
      const msg =
        (err as { response?: { data?: { message?: string; errors?: Array<{ msg: string }> } } })?.response?.data
          ?.message ||
        (err as { response?: { data?: { errors?: Array<{ msg: string }> } } })?.response?.data?.errors?.[0]?.msg ||
        'Erreur';
      toast.error(msg);
    } finally {
      setProcessingUserId(null);
    }
  };

  const confirmDeleteUser = async () => {
    const targetUser = deleteModal.user;
    if (!targetUser) return;
    setDeleteModal({ open: false, user: null });
    setProcessingUserId(targetUser.id);
    try {
      await api.delete(`/users/${targetUser.id}`);
      toast.success('Compte supprimé définitivement');
      await fetchData();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('delete_user');
        return;
      }
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erreur';
      toast.error(msg);
    } finally {
      setProcessingUserId(null);
    }
  };

  const openEditUser = (targetUser: User) => {
    const resolvedRoleId =
      targetUser.role_id || roles.find((r) => r.name === (targetUser.role_name || targetUser.role))?.id;

    setEditingUser(targetUser);
    setEditForm({
      fullname: targetUser.fullname || '',
      email: targetUser.email || '',
      role_id: resolvedRoleId ? String(resolvedRoleId) : '',
      direction_id: targetUser.direction_id ? String(targetUser.direction_id) : '',
    });
  };

  const closeEditUser = () => {
    setEditingUser(null);
    setEditForm({ fullname: '', email: '', role_id: '', direction_id: '' });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editForm.role_id) {
      toast.error('Le rôle est requis');
      return;
    }

    setProcessingUserId(editingUser.id);
    try {
      await api.put(`/users/${editingUser.id}`, {
        fullname: editForm.fullname.trim(),
        email: editForm.email.trim(),
        role_id: parseInt(editForm.role_id),
        direction_id: editForm.direction_id ? parseInt(editForm.direction_id) : null,
      });

      toast.success('Utilisateur modifié avec succès');
      closeEditUser();
      await fetchData();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('update_user');
        return;
      }
      const msg =
        (err as { response?: { data?: { message?: string; errors?: Array<{ msg: string }> } } })?.response?.data
          ?.message ||
        (err as { response?: { data?: { errors?: Array<{ msg: string }> } } })?.response?.data?.errors?.[0]?.msg ||
        'Erreur';
      toast.error(msg);
    } finally {
      setProcessingUserId(null);
    }
  };

  const openUserHistory = async (targetUser: User) => {
    setHistoryUser(targetUser);
    setHistoryActionFilter('ALL');
    setIsHistoryLoading(true);
    try {
      const res = await api.get(`/users/${targetUser.id}/history`);
      setHistoryItems(res.data.history || []);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('view_user_history');
        return;
      }
      setHistoryItems([]);
      toast.error('Impossible de charger l\'historique');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const closeUserHistory = () => {
    setHistoryUser(null);
    setHistoryItems([]);
    setHistoryActionFilter('ALL');
  };

  const historyActionOptions = (
    Object.keys(ACTION_LABELS) as Array<keyof typeof ACTION_LABELS>
  ).filter((actionKey) => historyItems.some((item) => item.action === actionKey));

  const filteredHistoryItems =
    historyActionFilter === 'ALL'
      ? historyItems
      : historyItems.filter((item) => item.action === historyActionFilter);

  return (
    <>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Utilisateurs" subtitle="Gestion des comptes et rôles" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          <div className="flex justify-end">
            <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
              <Plus size={16} />
              Nouvel utilisateur
            </button>
          </div>

          {/* Formulaire création */}
          {showForm && (
            <form onSubmit={handleCreate} className="card space-y-4 border-2 border-primary-100">
              <h2 className="font-semibold text-gray-900">Créer un utilisateur</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nom complet *</label>
                  <input type="text" value={form.fullname} onChange={(e) => setForm({ ...form, fullname: e.target.value })} className="input" required />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" required />
                </div>
                <div>
                  <label className="label">Mot de passe *</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="input"
                    minLength={6}
                    required
                  />
                </div>
                <div>
                  <label className="label">Rôle *</label>
                  <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} className="input" required>
                    <option value="">-- Choisir --</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Direction (si applicable)</label>
                  <select
                    value={form.direction_id}
                    onChange={(e) => setForm({ ...form, direction_id: e.target.value })}
                    className="input"
                    disabled={isCreateAssistantRole}
                  >
                    <option value="">-- Aucune --</option>
                    {directions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {isCreateAssistantRole && (
                    <p className="mt-1 text-xs text-slate-600">
                      Role Assistant detecte: rattachement automatique a {directionGenerale?.name || 'Direction Generale'}. 
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={isCreating} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                  {isCreating && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {isCreating ? 'Création...' : 'Créer'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
              </div>
            </form>
          )}

          {/* Formulaire édition */}
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="card space-y-4 border-2 border-amber-100">
              <h2 className="font-semibold text-gray-900">Modifier un utilisateur</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nom complet *</label>
                  <input
                    type="text"
                    value={editForm.fullname}
                    onChange={(e) => setEditForm({ ...editForm, fullname: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Rôle *</label>
                  <select
                    value={editForm.role_id}
                    onChange={(e) => setEditForm({ ...editForm, role_id: e.target.value })}
                    className="input"
                    required
                  >
                    <option value="">-- Choisir --</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Direction (si applicable)</label>
                  <select
                    value={editForm.direction_id}
                    onChange={(e) => setEditForm({ ...editForm, direction_id: e.target.value })}
                    className="input"
                    disabled={isEditAssistantRole}
                  >
                    <option value="">-- Aucune --</option>
                    {directions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {isEditAssistantRole && (
                    <p className="mt-1 text-xs text-slate-600">
                      Role Assistant detecte: rattachement automatique a {directionGenerale?.name || 'Direction Generale'}. 
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary" disabled={processingUserId === editingUser.id}>
                  Enregistrer les modifications
                </button>
                <button type="button" onClick={closeEditUser} className="btn-secondary">
                  Annuler
                </button>
              </div>
            </form>
          )}

          {/* Tableau utilisateurs */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Liste des utilisateurs</h2>
            {isLoading ? (
              <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase">Nom</th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Email</th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase">Rôle</th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Direction</th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                      <th className="pb-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map((u) => {
                      const normalizedUserRole = (u.role_name || u.role || '').toUpperCase().replace(/\s+/g, '_');
                      const isAssistantUser = ASSISTANT_ROLE_NAMES.has(normalizedUserRole);
                      const isProtocoleUser = normalizedUserRole === 'PROTOCOLE';
                      const roleBadgeClass = isProtocoleUser
                        ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200'
                        : 'bg-primary-100 text-primary-800';

                      return (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="py-3 pr-4 font-medium text-gray-900">{u.fullname}</td>
                        <td className="py-3 pr-4 text-gray-600 hidden sm:table-cell">{u.email}</td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleBadgeClass}`}>
                              {u.role_name || u.role}
                            </span>
                            {isAssistantUser && (
                              <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold border border-slate-200">
                                Rattache DG
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-gray-500 text-xs hidden md:table-cell">{u.direction_name || '—'}</td>
                        <td className="py-3 pr-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {u.is_active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openUserHistory(u)}
                              disabled={processingUserId === u.id}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Voir l'historique"
                            >
                              <History size={16} />
                            </button>

                            <button
                              onClick={() => openEditUser(u)}
                              disabled={processingUserId === u.id}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Modifier le profil"
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              onClick={() => toggleActive(u.id, u.is_active)}
                              disabled={processingUserId === u.id || currentUser?.id === u.id}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                              title={u.is_active ? 'Suspendre le compte' : 'Réactiver le compte'}
                            >
                              {u.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                            </button>

                            <button
                              onClick={() => setResetModal({ open: true, user: u })}
                              disabled={processingUserId === u.id}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Réinitialiser le mot de passe"
                            >
                              <KeyRound size={16} />
                            </button>

                            <button
                              onClick={() => {
                                if (currentUser?.id === u.id) {
                                  toast.error('Vous ne pouvez pas supprimer votre propre compte');
                                  return;
                                }
                                setDeleteModal({ open: true, user: u });
                              }}
                              disabled={processingUserId === u.id || currentUser?.id === u.id}
                              className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Supprimer le compte"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Historique utilisateur */}
          {historyUser && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">
                  Historique des actions admin — {historyUser.fullname}
                </h2>
                <button type="button" onClick={closeUserHistory} className="btn-secondary">
                  Fermer
                </button>
              </div>

              {isHistoryLoading ? (
                <div className="animate-pulse space-y-2">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
                </div>
              ) : historyItems.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun historique disponible pour ce compte.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setHistoryActionFilter('ALL')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        historyActionFilter === 'ALL'
                          ? 'bg-primary-100 text-primary-800 border-primary-200'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      Tous ({historyItems.length})
                    </button>

                    {historyActionOptions.map((actionKey) => {
                      const count = historyItems.filter((item) => item.action === actionKey).length;
                      return (
                        <button
                          key={actionKey}
                          type="button"
                          onClick={() => setHistoryActionFilter(actionKey)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            historyActionFilter === actionKey
                              ? 'bg-primary-100 text-primary-800 border-primary-200'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {ACTION_LABELS[actionKey]} ({count})
                        </button>
                      );
                    })}
                  </div>

                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase">Action</th>
                        <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase">Effectuée par</th>
                        <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase">Date/heure</th>
                        <th className="pb-3 text-xs font-semibold text-gray-500 uppercase">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredHistoryItems.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="py-3 pr-4 font-medium text-gray-900">
                            {ACTION_LABELS[item.action] || item.action}
                          </td>
                          <td className="py-3 pr-4 text-gray-600">
                            {item.actor_name || 'Système'}
                            {item.actor_email ? ` (${item.actor_email})` : ''}
                          </td>
                          <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                            {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                          </td>
                          <td className="py-3 text-gray-500">{item.ip_address || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>

                  {filteredHistoryItems.length === 0 && (
                      <p className="text-sm text-gray-500 mt-3">Aucun événement pour ce type d&apos;action.</p>
                  )}
                </>
              )}
            </div>
          )}
        </main>
        </div>
      </div>

    {/* Modal suppression */}
    <ConfirmModal
      isOpen={deleteModal.open}
      title="Supprimer le compte"
      message={`Supprimer définitivement le compte de ${deleteModal.user?.fullname} ?\nCette action est irréversible.`}
      confirmLabel="Supprimer définitivement"
      danger
      onConfirm={confirmDeleteUser}
      onCancel={() => setDeleteModal({ open: false, user: null })}
    />

    {/* Modal reset mot de passe */}
    <ConfirmModal
      isOpen={resetModal.open}
      title="Réinitialiser le mot de passe"
      message={`Réinitialiser le mot de passe de ${resetModal.user?.fullname} ?\nUn nouveau mot de passe sera envoyé par email et l'utilisateur devra le changer à la prochaine connexion.`}
      confirmLabel="Réinitialiser"
      onConfirm={handleResetPassword}
      onCancel={() => setResetModal({ open: false, user: null })}
    />
    </>
  );
}
