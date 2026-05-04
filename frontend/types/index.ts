// Types partagés frontend

export type StatutCourrier =
  | 'RECU'
  | 'ENTREE_DGA'
  | 'SORTIE_DGA'
  | 'ENTREE_DG'
  | 'SORTIE_DG'
  | 'ORIENTE'
  | 'RECU_DIRECTION'
  | 'EN_TRAITEMENT'
  | 'RETOUR'
  | 'ENTREE_DGA_RETOUR'
  | 'SORTIE_DGA_RETOUR'
  | 'ENTREE_DG_RETOUR'
  | 'SORTIE_DG_RETOUR'
  | 'SORTANT_ENREGISTRE'
  | 'SORTANT_ENVOYE'
  | 'CLASSE';

export interface Courrier {
  id: number;
  reference: string;
  numero?: string;
  nombre_annexes?: number;
  objet: string;
  expediteur: string;
  date_reception: string;
  fichier_joint?: string;
  statut: StatutCourrier;
  direction_id?: number;
  direction_name?: string;
  direction_code?: string;
  created_by: number;
  created_by_name?: string;
  priorite: 'NORMALE' | 'URGENTE' | 'CONFIDENTIELLE';
  type_courrier: 'ENTRANT' | 'SORTANT';
  notes?: string;
  created_at: string;
}

export interface Tracking {
  id: number;
  courrier_id: number;
  action: string;
  acteur_id: number;
  acteur_name?: string;
  role: string;
  statut_avant?: StatutCourrier;
  statut_apres?: StatutCourrier;
  date_action: string;
  commentaire?: string;
}

export interface User {
  id: number;
  fullname: string;
  email: string;
  role: string;
  role_id?: number;
  role_name?: string;
  direction_id?: number;
  directionId?: number;
  direction_name?: string;
  directionName?: string;
  must_change_password?: boolean;
  mustChangePassword?: boolean;
  is_active: boolean;
}

export interface Direction {
  id: number;
  name: string;
  code: string;
  description?: string;
  nb_utilisateurs?: number;
}

export interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  reference?: string;
  objet?: string;
}

export interface PieceJointe {
  id: number;
  courrier_id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: number;
  uploaded_by_name?: string;
  created_at: string;
}

export interface OcrJob {
  id: number;
  piece_jointe_id: number;
  status: 'PENDING' | 'PROCESSING' | 'FAILED' | 'DONE';
  attempts: number;
  run_after?: string;
  last_error?: string;
  locked_at?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  finished_at?: string;
  processing_ms?: number;
  file_name?: string;
  mime_type?: string;
  courrier_id?: number;
  courrier_reference?: string;
}

export interface OcrMetrics {
  totalJobs: number;
  pendingJobs: number;
  processingJobs: number;
  failedJobs: number;
  doneJobs: number;
  avgProcessingMs: number;
  failureRate: number;
}

export const STATUT_LABELS: Record<StatutCourrier, string> = {
  RECU: 'Reçu',
  ENTREE_DGA: 'Entrée DGA',
  SORTIE_DGA: 'Sortie DGA',
  ENTREE_DG: 'Entrée DG',
  SORTIE_DG: 'Sortie DG',
  ORIENTE: 'Orienté',
  RECU_DIRECTION: 'Reçu (Direction)',
  EN_TRAITEMENT: 'En traitement',
  RETOUR: 'Retour',
  ENTREE_DGA_RETOUR: 'Entrée DGA (retour)',
  SORTIE_DGA_RETOUR: 'Sortie DGA (retour)',
  ENTREE_DG_RETOUR: 'Entrée DG (retour)',
  SORTIE_DG_RETOUR: 'Sortie DG (retour)',
  SORTANT_ENREGISTRE: 'Sortant enregistré',
  SORTANT_ENVOYE: 'Envoyé',
  CLASSE: 'Classé',
};

export const STATUT_COLORS: Record<StatutCourrier, string> = {
  RECU: 'bg-blue-100 text-blue-800',
  ENTREE_DGA: 'bg-purple-100 text-purple-800',
  SORTIE_DGA: 'bg-purple-200 text-purple-900',
  ENTREE_DG: 'bg-indigo-100 text-indigo-800',
  SORTIE_DG: 'bg-indigo-200 text-indigo-900',
  ORIENTE: 'bg-yellow-100 text-yellow-800',
  RECU_DIRECTION: 'bg-orange-100 text-orange-800',
  EN_TRAITEMENT: 'bg-orange-200 text-orange-900',
  RETOUR: 'bg-gray-100 text-gray-800',
  ENTREE_DGA_RETOUR: 'bg-purple-100 text-purple-800',
  SORTIE_DGA_RETOUR: 'bg-purple-200 text-purple-900',
  ENTREE_DG_RETOUR: 'bg-indigo-100 text-indigo-800',
  SORTIE_DG_RETOUR: 'bg-indigo-200 text-indigo-900',
  SORTANT_ENREGISTRE: 'bg-teal-100 text-teal-800',
  SORTANT_ENVOYE: 'bg-green-100 text-green-800',
  CLASSE: 'bg-gray-200 text-gray-700',
};

export const ROLES_GLOBAUX = [
  'ADMIN',
  'DG',
  'DGA',
  'PROTOCOLE',
  'SECRETAIRE_ADMIN',
  'SECRETAIRE_ADMIN_ADJ',
  'SECRETAIRE_DG',
  'SECRETAIRE_DGA',
  'COURRIER_ENTRANT',
  'COURRIER_SORTANT',
];

export const ROLES_RECEPTION_COURRIERS = [
  'COURRIER_ENTRANT',
  'COURRIER_SORTANT',
  'SECRETAIRE_ADMIN',
  'SECRETAIRE_ADMIN_ADJ',
  'SECRETAIRE_DG',
  'SECRETAIRE_DGA',
  'ADMIN',
];
