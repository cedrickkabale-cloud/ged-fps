'use client';

import { clsx } from 'clsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Download, Info, Paperclip, Pencil, Printer, Trash2, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../../components/ConfirmModal';
import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';
import WorkflowTimeline from '../../../components/WorkflowTimeline';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../lib/api';
import {
    Courrier,
    Direction,
    PieceJointe,
    ROLES_RECEPTION_COURRIERS,
    STATUT_COLORS,
    STATUT_LABELS,
    StatutCourrier,
    Tracking
} from '../../../types';

// Actions disponibles selon rôle et statut actuel
const ACTIONS_BY_ROLE: Record<string, { action: string; label: string; fromStatuts: StatutCourrier[] }[]> = {
  SECRETAIRE_DG: [
    { action: 'ENTREE_DG', label: 'Entrée DG', fromStatuts: ['RECU'] },
    { action: 'SORTIE_DG', label: 'Sortie DG', fromStatuts: ['ENTREE_DG'] },
  ],
  SECRETAIRE_DGA: [
    { action: 'ENTREE_DGA', label: 'Entrée DGA', fromStatuts: ['SORTIE_DG'] },
    { action: 'SORTIE_DGA', label: 'Sortie DGA', fromStatuts: ['ENTREE_DGA'] },
  ],
  SECRETAIRE_ADMIN: [
    { action: 'ENTREE_DG', label: 'Entrée DG', fromStatuts: ['RECU'] },
    { action: 'SORTIE_DG', label: 'Sortie DG', fromStatuts: ['ENTREE_DG'] },
    { action: 'ENTREE_DGA', label: 'Entrée DGA', fromStatuts: ['SORTIE_DG'] },
    { action: 'SORTIE_DGA', label: 'Sortie DGA', fromStatuts: ['ENTREE_DGA'] },
    { action: 'ORIENTE', label: 'Orienter vers une direction', fromStatuts: ['RECU', 'SORTIE_DG', 'SORTIE_DGA', 'ORIENTE'] },
    { action: 'RETOUR', label: 'Marquer en retour', fromStatuts: ['RECU_DIRECTION', 'EN_TRAITEMENT'] },
    { action: 'ENTREE_DG_RETOUR', label: 'Entrée DG (retour)', fromStatuts: ['RETOUR'] },
    { action: 'SORTIE_DG_RETOUR', label: 'Sortie DG (retour)', fromStatuts: ['ENTREE_DG_RETOUR'] },
    { action: 'ENTREE_DGA_RETOUR', label: 'Entrée DGA (retour)', fromStatuts: ['SORTIE_DG_RETOUR'] },
    { action: 'SORTIE_DGA_RETOUR', label: 'Sortie DGA (retour)', fromStatuts: ['ENTREE_DGA_RETOUR'] },
    { action: 'SORTANT_ENREGISTRE', label: 'Enregistrer courrier sortant', fromStatuts: ['SORTIE_DGA_RETOUR'] },
    { action: 'CLASSE', label: 'Classer le courrier', fromStatuts: ['SORTANT_ENVOYE'] },
  ],
  SECRETAIRE_ADMIN_ADJ: [
    { action: 'ENTREE_DG', label: 'Entrée DG', fromStatuts: ['RECU'] },
    { action: 'SORTIE_DG', label: 'Sortie DG', fromStatuts: ['ENTREE_DG'] },
    { action: 'ENTREE_DGA', label: 'Entrée DGA', fromStatuts: ['SORTIE_DG'] },
    { action: 'SORTIE_DGA', label: 'Sortie DGA', fromStatuts: ['ENTREE_DGA'] },
    { action: 'ORIENTE', label: 'Orienter vers une direction', fromStatuts: ['RECU', 'SORTIE_DG', 'SORTIE_DGA', 'ORIENTE'] },
    { action: 'RETOUR', label: 'Marquer en retour', fromStatuts: ['RECU_DIRECTION', 'EN_TRAITEMENT'] },
    { action: 'ENTREE_DG_RETOUR', label: 'Entrée DG (retour)', fromStatuts: ['RETOUR'] },
    { action: 'SORTIE_DG_RETOUR', label: 'Sortie DG (retour)', fromStatuts: ['ENTREE_DG_RETOUR'] },
    { action: 'ENTREE_DGA_RETOUR', label: 'Entrée DGA (retour)', fromStatuts: ['SORTIE_DG_RETOUR'] },
    { action: 'SORTIE_DGA_RETOUR', label: 'Sortie DGA (retour)', fromStatuts: ['ENTREE_DGA_RETOUR'] },
    { action: 'SORTANT_ENREGISTRE', label: 'Enregistrer courrier sortant', fromStatuts: ['SORTIE_DGA_RETOUR'] },
  ],
  PROTOCOLE: [
    { action: 'ORIENTE', label: 'Orienter vers une direction', fromStatuts: ['RECU', 'SORTIE_DG', 'SORTIE_DGA', 'ORIENTE'] },
  ],
  DG: [
    { action: 'RETOUR', label: 'Marquer en retour', fromStatuts: ['RECU_DIRECTION', 'EN_TRAITEMENT'] },
  ],
  DGA: [
    { action: 'RETOUR', label: 'Marquer en retour', fromStatuts: ['RECU_DIRECTION', 'EN_TRAITEMENT'] },
  ],
  ASSISTANT_TECHNIQUE: [
    { action: 'RETOUR', label: 'Marquer en retour', fromStatuts: ['RECU_DIRECTION', 'EN_TRAITEMENT'] },
  ],
  ASSISTANT_JURIDIQUE: [
    { action: 'RETOUR', label: 'Marquer en retour', fromStatuts: ['RECU_DIRECTION', 'EN_TRAITEMENT'] },
  ],
  ASSISTANT_FINANCIER: [
    { action: 'RETOUR', label: 'Marquer en retour', fromStatuts: ['RECU_DIRECTION', 'EN_TRAITEMENT'] },
  ],
  DIRECTEUR: [
    { action: 'RECU_DIRECTION', label: 'Marquer Recu', fromStatuts: ['ORIENTE'] },
    { action: 'RETOUR', label: 'Fin de traitement', fromStatuts: ['RECU_DIRECTION', 'EN_TRAITEMENT'] },
  ],
  SECRETAIRE_DIRECTION: [
    { action: 'RECU_DIRECTION', label: 'Marquer Recu', fromStatuts: ['ORIENTE'] },
    { action: 'RETOUR', label: 'Fin de traitement', fromStatuts: ['RECU_DIRECTION', 'EN_TRAITEMENT'] },
  ],
  COURRIER_SORTANT: [
    { action: 'SORTANT_ENREGISTRE', label: 'Enregistrer courrier sortant', fromStatuts: ['SORTIE_DG_RETOUR', 'SORTIE_DGA_RETOUR', 'RETOUR'] },
  ],
  ADMIN: [
    { action: 'ENTREE_DG', label: 'Entrée DG', fromStatuts: ['RECU'] },
    { action: 'SORTIE_DG', label: 'Sortie DG', fromStatuts: ['ENTREE_DG'] },
    { action: 'ENTREE_DGA', label: 'Entrée DGA', fromStatuts: ['SORTIE_DG', 'RECU'] },
    { action: 'SORTIE_DGA', label: 'Sortie DGA', fromStatuts: ['ENTREE_DGA'] },
    { action: 'RECU_DIRECTION', label: 'Réception direction', fromStatuts: ['ORIENTE'] },
    { action: 'RETOUR', label: 'Retour', fromStatuts: ['RECU_DIRECTION', 'EN_TRAITEMENT'] },
    { action: 'ENTREE_DG_RETOUR', label: 'Entrée DG retour', fromStatuts: ['RETOUR'] },
    { action: 'SORTIE_DG_RETOUR', label: 'Sortie DG retour', fromStatuts: ['ENTREE_DG_RETOUR'] },
    { action: 'ENTREE_DGA_RETOUR', label: 'Entrée DGA retour', fromStatuts: ['SORTIE_DG_RETOUR'] },
    { action: 'SORTIE_DGA_RETOUR', label: 'Sortie DGA retour', fromStatuts: ['ENTREE_DGA_RETOUR'] },
    { action: 'SORTANT_ENREGISTRE', label: 'Enregistrer sortant', fromStatuts: ['SORTIE_DGA_RETOUR'] },
    { action: 'SORTANT_ENVOYE', label: 'Confirmer envoi', fromStatuts: ['SORTANT_ENREGISTRE'] },
    { action: 'CLASSE', label: 'Classer', fromStatuts: ['SORTANT_ENVOYE'] },
  ],
};

const PRINCIPAL_ROLES = [
  'ADMIN',
  'DG',
  'DGA',
  'PROTOCOLE',
  'SECRETAIRE_ADMIN',
  'SECRETAIRE_ADMIN_ADJ',
  'SECRETAIRE_DG',
  'SECRETAIRE_DGA',
  'ASSISTANT_TECHNIQUE',
  'ASSISTANT_JURIDIQUE',
  'ASSISTANT_FINANCIER',
];

const ASSISTANT_DIRECTION_CODE_BY_ROLE: Record<string, string> = {
  ASSISTANT_TECHNIQUE: 'DT',
  ASSISTANT_JURIDIQUE: 'DJ',
  ASSISTANT_FINANCIER: 'DF',
};

const ROLES_DELETE_COURRIER = ['ADMIN', 'DG', 'DGA', 'SECRETAIRE_ADMIN', 'SECRETAIRE_ADMIN_ADJ'];

const RETARD_TRAITEMENT_MS = 48 * 60 * 60 * 1000;

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}j ${hours}h ${minutes}m`;
  return `${hours}h ${minutes}m`;
};

export default function CourrierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [courrier, setCourrier] = useState<Courrier | null>(null);
  const [tracking, setTracking] = useState<Tracking[]>([]);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [selectedAction, setSelectedAction] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [selectedDirection, setSelectedDirection] = useState('');
  const [numerSortant, setNumerSortant] = useState('');
  const [destinataire, setDestinataire] = useState('');

  // Pièces jointes
  const [piecesJointes, setPiecesJointes] = useState<PieceJointe[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [deletePieceModal, setDeletePieceModal] = useState<{ open: boolean; piece: PieceJointe | null }>({ open: false, piece: null });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nowTs, setNowTs] = useState(Date.now());

  // Modification du courrier
  const [editModal, setEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    objet: '', expediteur: '', reference: '', numero: '',
    nombre_annexes: 0, date_reception: '', priorite: 'NORMALE' as 'NORMALE' | 'URGENTE' | 'CONFIDENTIELLE', notes: '',
  });

  // Suppression du courrier
  const [deleteCourrierModal, setDeleteCourrierModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const redirectAccessDenied = (action: string) => {
    const from = encodeURIComponent(`/courriers/${id}`);
    router.push(`/acces-refuse?action=${action}&from=${from}`);
  };

  const fetchData = async () => {
    try {
      const courrierRes = await api.get(`/courriers/${id}`);
      setCourrier(courrierRes.data.courrier);
      setTracking(courrierRes.data.tracking);
      setPiecesJointes(courrierRes.data.piecesJointes || []);

      // Les profils non globaux peuvent être interdits sur /directions.
      // Dans ce cas on conserve l'écran détail fonctionnel sans bloquer le chargement.
      try {
        const dirsRes = await api.get('/directions');
        setDirections(dirsRes.data.data || []);
      } catch {
        setDirections([]);
      }
    } catch {
      toast.error('Erreur chargement du courrier');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      toast.error('Type non autorisé (PDF, JPG, PNG uniquement)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10 MB)');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setIsUploading(true);
    try {
      const res = await api.post(`/courriers/${id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPiecesJointes((prev) => [...prev, res.data.pieceJointe]);
      toast.success('Fichier ajouté');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('upload_attachment');
        return;
      }
      toast.error('Erreur lors de l\u2019upload');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmDeletePiece = async () => {
    const piece = deletePieceModal.piece;
    if (!piece) return;
    setDeletePieceModal({ open: false, piece: null });
    try {
      await api.delete(`/courriers/pieces-jointes/${piece.id}`);
      setPiecesJointes((prev) => prev.filter((p) => p.id !== piece.id));
      toast.success('Pièce jointe supprimée');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('delete_attachment');
        return;
      }
      toast.error('Erreur suppression');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  // Chargement initial volontaire au montage de la page.
  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTs(Date.now()), 1000 * 30);
    return () => window.clearInterval(interval);
  }, []);

  const normalizedRole = (user?.role || user?.role_name || '').toUpperCase().replace(/\s+/g, '_');

  const availableActions = (ACTIONS_BY_ROLE[normalizedRole] || []).filter(
    (a) => courrier && a.fromStatuts.includes(courrier.statut)
  );

  const ORIENTABLE_STATUTS: StatutCourrier[] = ['SORTIE_DG', 'SORTIE_DGA', 'RECU', 'ORIENTE'];
  const showOrientationNotice =
    courrier !== null &&
    ORIENTABLE_STATUTS.includes(courrier.statut);

  const canPrintLabel = ROLES_RECEPTION_COURRIERS.includes(normalizedRole);
  const canEdit = ROLES_RECEPTION_COURRIERS.includes(normalizedRole);
  const canDelete = ROLES_DELETE_COURRIER.includes(normalizedRole);
  const canConfirmDepot =
    (normalizedRole === 'COURRIER_SORTANT' || normalizedRole === 'PROTOCOLE') &&
    courrier?.statut === 'SORTANT_ENREGISTRE';

  const handleAction = async () => {
    if (!selectedAction) {
      toast.error('Sélectionnez une action');
      return;
    }
    if (selectedAction === 'ORIENTE' && !selectedDirection) {
      toast.error('Sélectionnez une direction');
      return;
    }

    setIsActing(true);
    try {
      await api.post(`/courriers/${id}/workflow`, {
        action: selectedAction,
        commentaire,
        direction_id: selectedDirection ? parseInt(selectedDirection) : undefined,
        numero_sortant: numerSortant || undefined,
        destinataire: destinataire || undefined,
      });
      toast.success('Action enregistrée avec succès');
      setSelectedAction('');
      setCommentaire('');
      setSelectedDirection('');
      setNumerSortant('');
      setDestinataire('');
      await fetchData();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('workflow_action');
        return;
      }
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erreur';
      toast.error(msg);
    } finally {
      setIsActing(false);
    }
  };

  const handlePrintLabel = async () => {
    if (!courrier) return;
    router.push(`/courriers/${courrier.id}/etiquette`);
  };

  const openEditModal = () => {
    if (!courrier) return;
    setEditForm({
      objet: courrier.objet,
      expediteur: courrier.expediteur,
      reference: courrier.reference || '',
      numero: courrier.numero || '',
      nombre_annexes: typeof courrier.nombre_annexes === 'number' ? courrier.nombre_annexes : 0,
      date_reception: courrier.date_reception.slice(0, 10),
      priorite: courrier.priorite,
      notes: courrier.notes || '',
    });
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!courrier) return;
    setIsSaving(true);
    try {
      await api.put(`/courriers/${courrier.id}`, {
        ...editForm,
        reference: editForm.reference || null,
        numero: editForm.numero || null,
        notes: editForm.notes || null,
      });
      toast.success('Courrier modifié avec succès');
      setEditModal(false);
      await fetchData();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('edit_courrier');
        return;
      }
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erreur lors de la modification';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCourrier = async () => {
    if (!courrier) return;
    setIsDeleting(true);
    try {
      await api.delete(`/courriers/${courrier.id}`);
      toast.success('Courrier supprimé');
      router.push('/courriers');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setDeleteCourrierModal(false);
        redirectAccessDenied('delete_courrier');
        return;
      }
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erreur lors de la suppression';
      toast.error(msg);
    } finally {
      setIsDeleting(false);
      setDeleteCourrierModal(false);
    }
  };

  const handleConfirmDepot = async () => {
    if (!courrier) return;
    setIsActing(true);
    try {
      await api.post(`/courriers/${courrier.id}/sortant/confirmer`);
      toast.success('Courrier déposé avec succès');
      await fetchData();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        redirectAccessDenied('confirm_sortant_depot');
        return;
      }
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erreur de confirmation du dépôt';
      toast.error(msg);
    } finally {
      setIsActing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!courrier) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500">Courrier introuvable</p>
            <Link href="/courriers" className="btn-primary mt-4 inline-block">Retour</Link>
          </div>
        </div>
      </div>
    );
  }

  const assistantTargetCode = ASSISTANT_DIRECTION_CODE_BY_ROLE[normalizedRole];
  const assistantCanSeeDirectionTracking = assistantTargetCode
    ? courrier.direction_code === assistantTargetCode
    : false;
  const isPrincipalProfile = PRINCIPAL_ROLES.includes(normalizedRole) && (!assistantTargetCode || assistantCanSeeDirectionTracking);
  const recuDirectionEvent = [...tracking]
    .reverse()
    .find((t) => t.action === 'RECU_DIRECTION' || t.statut_apres === 'RECU_DIRECTION');
  const finTraitementEvent = [...tracking]
    .reverse()
    .find((t) => t.action === 'RETOUR' && recuDirectionEvent && new Date(t.date_action) > new Date(recuDirectionEvent.date_action));

  const recuAt = recuDirectionEvent ? new Date(recuDirectionEvent.date_action).getTime() : null;
  const finAt = finTraitementEvent ? new Date(finTraitementEvent.date_action).getTime() : null;
  const traitementDurationMs = recuAt ? (finAt ? finAt - recuAt : nowTs - recuAt) : null;
  const traitementRunning = Boolean(recuAt && !finAt);
  const isDelayed = Boolean(traitementRunning && traitementDurationMs !== null && traitementDurationMs >= RETARD_TRAITEMENT_MS);

  return (
    <>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            title={`Courrier ${courrier.reference || `#${courrier.id}`}`}
            subtitle={courrier.objet}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5"
          >
            <ArrowLeft size={16} />
            Retour à la liste
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Colonne principale */}
            <div className="lg:col-span-2 space-y-5">
              {/* Infos courrier */}
              <div className="card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
                  <h2 className="font-semibold text-gray-900">Informations du courrier</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    {canEdit && (
                      <button
                        onClick={openEditModal}
                        className="btn-secondary inline-flex items-center gap-2"
                      >
                        <Pencil size={16} />
                        Modifier
                      </button>
                    )}
                    {canPrintLabel && (
                      <button
                        onClick={handlePrintLabel}
                        className="btn-secondary inline-flex items-center gap-2"
                      >
                        <Printer size={16} />
                        Imprimer l&apos;étiquette
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => setDeleteCourrierModal(true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={16} />
                        Supprimer
                      </button>
                    )}
                    <span className={clsx('px-3 py-1 rounded-full text-xs font-medium', STATUT_COLORS[courrier.statut])}>
                      {STATUT_LABELS[courrier.statut]}
                    </span>
                  </div>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <dt className="text-gray-500">Référence</dt>
                    <dd className="font-mono font-medium text-gray-900 mt-0.5">
                      {courrier.reference || `#${courrier.id}`}
                    </dd>
                  </div>
                  <div>
                      <dt className="text-gray-500">Nombre d&apos;annexes</dt>
                    <dd className="font-medium text-gray-900 mt-0.5">
                      {typeof courrier.nombre_annexes === 'number' ? courrier.nombre_annexes : 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Date de réception</dt>
                    <dd className="font-medium text-gray-900 mt-0.5">
                      {format(new Date(courrier.date_reception), 'dd MMMM yyyy', { locale: fr })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Expéditeur</dt>
                    <dd className="font-medium text-gray-900 mt-0.5">{courrier.expediteur}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Priorité</dt>
                    <dd className="mt-0.5">
                      <span className={clsx('font-medium', {
                        'text-red-600': courrier.priorite === 'URGENTE',
                        'text-orange-600': courrier.priorite === 'CONFIDENTIELLE',
                        'text-gray-900': courrier.priorite === 'NORMALE',
                      })}>
                        {courrier.priorite}
                      </span>
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-gray-500">Objet</dt>
                    <dd className="font-medium text-gray-900 mt-0.5">{courrier.objet}</dd>
                  </div>
                  {courrier.direction_name && (
                    <div>
                      <dt className="text-gray-500">Direction assignée</dt>
                      <dd className="font-medium text-gray-900 mt-0.5">{courrier.direction_name}</dd>
                    </div>
                  )}
                  {courrier.notes && (
                    <div className="col-span-2">
                      <dt className="text-gray-500">Notes</dt>
                      <dd className="text-gray-700 mt-0.5 bg-gray-50 rounded p-2 text-xs">{courrier.notes}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-gray-500">Enregistré par</dt>
                    <dd className="font-medium text-gray-900 mt-0.5">{courrier.created_by_name}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Date création</dt>
                    <dd className="font-medium text-gray-900 mt-0.5">
                      {format(new Date(courrier.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Pièces jointes */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Paperclip size={16} className="text-gray-500" />
                    <h2 className="font-semibold text-gray-900">
                      Pièces jointes
                      {piecesJointes.length > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                          {piecesJointes.length}
                        </span>
                      )}
                    </h2>
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={handleUpload}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="btn-secondary inline-flex items-center gap-1.5 text-xs"
                    >
                      {isUploading ? (
                        <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload size={13} />
                      )}
                      {isUploading ? 'Upload...' : 'Ajouter'}
                    </button>
                  </div>
                </div>

                {piecesJointes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Aucune pièce jointe</p>
                ) : (
                  <ul className="space-y-2">
                    {piecesJointes.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip size={14} className="text-slate-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{p.file_name}</p>
                            <p className="text-xs text-slate-500">{formatFileSize(p.file_size)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <a
                            href={`/uploads/${p.file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={p.file_name}
                            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                            title="Télécharger"
                          >
                            <Download size={14} />
                          </a>
                          <button
                            onClick={() => setDeletePieceModal({ open: true, piece: p })}
                            className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Colonne droite : workflow + timeline */}
            <div className="space-y-5">
              {/* Statut de traitement direction (visible aux profils principaux) */}
              {isPrincipalProfile && recuAt && (
                <div className={clsx('card border', isDelayed ? 'border-red-200 bg-red-50' : traitementRunning ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50')}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h2 className="font-semibold text-gray-900">Suivi de la direction</h2>
                    {isDelayed && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 border border-red-300">
                        Retard +48h
                      </span>
                    )}
                  </div>
                  <p className={clsx('text-sm font-medium', traitementRunning ? 'text-amber-800' : 'text-emerald-800')}>
                    {traitementRunning ? 'Traitement en cours dans la direction' : 'Traitement termine dans la direction'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Duree depuis Recu : {traitementDurationMs !== null ? formatDuration(traitementDurationMs) : '-'}
                  </p>
                  {isDelayed && (
                    <p className="text-xs text-red-700 mt-2">
                        Alerte pilotage: la direction n&apos;a pas encore clique sur Fin de traitement apres 48 heures.
                    </p>
                  )}
                  <button
                    type="button"
                    disabled
                    className={clsx(
                      'mt-3 w-full rounded-lg px-3 py-2 text-xs font-medium border',
                      isDelayed
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : traitementRunning
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    )}
                  >
                    {traitementRunning ? 'Fin de traitement: en attente direction' : 'Fin de traitement: confirmee'}
                  </button>
                </div>
              )}

              {normalizedRole === 'PROTOCOLE' && courrier.statut === 'ORIENTE' && !recuAt && (
                <div className="card border border-amber-200 bg-amber-50">
                  <h2 className="font-semibold text-gray-900 mb-1">Suivi Protocole</h2>
                  <p className="text-sm text-amber-800 font-medium">Validation de reception direction en attente</p>
                  <p className="text-xs text-amber-700 mt-1">
                      Le courrier est oriente. En attente de confirmation &quot;Recu&quot; par la direction cible.
                  </p>
                </div>
              )}

              {/* Actions workflow */}
              {availableActions.length > 0 && (
                <div className="card border-2 border-primary-100">
                  <h2 className="font-semibold text-gray-900 mb-4">Actions disponibles</h2>

                  <div className="space-y-3">
                    <div>
                      <label className="label">Action *</label>
                      <select
                        value={selectedAction}
                        onChange={(e) => setSelectedAction(e.target.value)}
                        className="input"
                      >
                        <option value="">-- Choisir --</option>
                        {availableActions.map((a) => (
                          <option key={a.action} value={a.action}>{a.label}</option>
                        ))}
                      </select>
                    </div>

                    {selectedAction === 'ORIENTE' && (
                      <div>
                        <label className="label">Direction *</label>
                        <select
                          value={selectedDirection}
                          onChange={(e) => setSelectedDirection(e.target.value)}
                          className="input"
                        >
                          <option value="">-- Sélectionner --</option>
                          {directions.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedAction === 'SORTANT_ENREGISTRE' && (
                      <>
                        <div>
                          <label className="label">N° courrier sortant</label>
                          <input
                            type="text"
                            value={numerSortant}
                            onChange={(e) => setNumerSortant(e.target.value)}
                            className="input"
                            placeholder="CS-2026-001"
                          />
                        </div>
                        <div>
                          <label className="label">Destinataire</label>
                          <input
                            type="text"
                            value={destinataire}
                            onChange={(e) => setDestinataire(e.target.value)}
                            className="input"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="label">Commentaire (optionnel)</label>
                      <textarea
                        value={commentaire}
                        onChange={(e) => setCommentaire(e.target.value)}
                        className="input resize-none"
                        rows={3}
                        placeholder="Remarque..."
                      />
                    </div>

                    <button
                      onClick={handleAction}
                      disabled={isActing || !selectedAction}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      {isActing ? (
                        <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      ) : null}
                      {isActing ? 'En cours...' : 'Valider l\'action'}
                    </button>
                  </div>
                </div>
              )}

              {canConfirmDepot && (
                <div className="card border-2 border-emerald-100 bg-emerald-50">
                  <h2 className="font-semibold text-gray-900 mb-2">Courrier sortant</h2>
                  <p className="text-xs text-emerald-800 mb-3">
                      Après dépôt physique du courrier, confirmez l&apos;action pour finaliser cette étape du circuit.
                  </p>
                  <button
                    onClick={handleConfirmDepot}
                    disabled={isActing}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isActing ? 'Confirmation...' : 'Courrier déposé'}
                  </button>
                </div>
              )}

              {/* Message si le courrier est orientable mais l'utilisateur n'a pas la permission */}
              {showOrientationNotice && (
                <div className="card border border-amber-200 bg-amber-50">
                  <div className="flex items-start gap-3">
                    <Info size={18} className="text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Orientation non disponible</p>
                      <p className="text-xs text-amber-700 mt-1">
                          Ce courrier est en attente d&apos;orientation vers une direction. Seule la
                        <strong> Secrétaire Administrative</strong>, son
                        <strong> Adjoint(e)</strong> ou le profil
                        <strong> Protocole</strong> est habilité à effectuer cette action.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-5">Historique du circuit</h2>
                <WorkflowTimeline tracking={tracking} />
              </div>
            </div>
          </div>
          </main>
        </div>
      </div>

      <ConfirmModal
        isOpen={deletePieceModal.open}
        title="Supprimer la pièce jointe"
        message={`Supprimer le fichier "${deletePieceModal.piece?.file_name}" ?\nCette action est irréversible.`}
        confirmLabel="Supprimer"
        danger
        onConfirm={confirmDeletePiece}
        onCancel={() => setDeletePieceModal({ open: false, piece: null })}
      />

      <ConfirmModal
        isOpen={deleteCourrierModal}
        title="Supprimer le courrier"
        message={`Vous êtes sur le point de supprimer définitivement le courrier "${courrier?.reference || `#${courrier?.id}`}".\n\nToutes les données associées (historique, pièces jointes) seront effacées.\n\nCette action est irréversible.`}
        confirmLabel={isDeleting ? 'Suppression...' : 'Oui, supprimer'}
        cancelLabel="Annuler"
        danger
        onConfirm={handleDeleteCourrier}
        onCancel={() => setDeleteCourrierModal(false)}
      />

      {/* Modal de modification */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setEditModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 fade-in-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-slate-900">Modifier le courrier</h3>
              <button onClick={() => setEditModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Objet *</label>
                <input
                  type="text"
                  value={editForm.objet}
                  onChange={(e) => setEditForm((f) => ({ ...f, objet: e.target.value }))}
                  className="input"
                />
              </div>
              <div className="col-span-2">
                <label className="label">Expéditeur *</label>
                <input
                  type="text"
                  value={editForm.expediteur}
                  onChange={(e) => setEditForm((f) => ({ ...f, expediteur: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Référence</label>
                <input
                  type="text"
                  value={editForm.reference}
                  onChange={(e) => setEditForm((f) => ({ ...f, reference: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Numéro</label>
                <input
                  type="text"
                  value={editForm.numero}
                  onChange={(e) => setEditForm((f) => ({ ...f, numero: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Date de réception *</label>
                <input
                  type="date"
                  value={editForm.date_reception}
                  onChange={(e) => setEditForm((f) => ({ ...f, date_reception: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Nombre d&apos;annexes</label>
                <input
                  type="number"
                  min={0}
                  value={editForm.nombre_annexes}
                  onChange={(e) => setEditForm((f) => ({ ...f, nombre_annexes: parseInt(e.target.value) || 0 }))}
                  className="input"
                />
              </div>
              <div className="col-span-2">
                <label className="label">Priorité *</label>
                <select
                  value={editForm.priorite}
                  onChange={(e) => setEditForm((f) => ({ ...f, priorite: e.target.value as 'NORMALE' | 'URGENTE' | 'CONFIDENTIELLE' }))}
                  className="input"
                >
                  <option value="NORMALE">Normale</option>
                  <option value="URGENTE">Urgente</option>
                  <option value="CONFIDENTIELLE">Confidentielle</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  className="input resize-none"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditModal(false)}
                className="btn-secondary"
                disabled={isSaving}
              >
                Annuler
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving || !editForm.objet || !editForm.expediteur || !editForm.date_reception}
                className="btn-primary inline-flex items-center gap-2"
              >
                {isSaving && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
