// Types partagés du projet GED FPS

export interface User {
  id: number;
  fullname: string;
  email: string;
  role_id: number;
  role_name?: string;
  direction_id?: number;
  direction_name?: string;
  is_active: boolean;
  created_at: Date;
}

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  directionId?: number;
}

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

export const WORKFLOW_STEPS: Record<StatutCourrier, string> = {
  RECU: 'Reçu à la réception',
  ENTREE_DGA: 'Entrée au bureau DGA',
  SORTIE_DGA: 'Sortie du bureau DGA',
  ENTREE_DG: 'Entrée au bureau DG',
  SORTIE_DG: 'Sortie du bureau DG',
  ORIENTE: 'Orienté vers une direction',
  RECU_DIRECTION: 'Reçu par la direction',
  EN_TRAITEMENT: 'En cours de traitement',
  RETOUR: 'Retour à la réception',
  ENTREE_DGA_RETOUR: 'Entrée DGA (retour)',
  SORTIE_DGA_RETOUR: 'Sortie DGA (retour)',
  ENTREE_DG_RETOUR: 'Entrée DG (retour)',
  SORTIE_DG_RETOUR: 'Sortie DG (retour)',
  SORTANT_ENREGISTRE: 'Courrier sortant enregistré',
  SORTANT_ENVOYE: 'Courrier sortant envoyé',
  CLASSE: 'Classé',
};
