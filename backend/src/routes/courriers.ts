import { Response, Router } from 'express';
import { body, query as queryParam, validationResult } from 'express-validator';
import fs from 'fs';
import path from 'path';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { enqueueOcrJob } from '../services/ocrQueue';
import { ROLES_GLOBAUX, StatutCourrier } from '../types';

const router = Router();

const ASSISTANT_DIRECTION_CODES_BY_ROLE: Record<string, string[]> = {
  ASSISTANT_TECHNIQUE: ['DT'],
  ASSISTANT_JURIDIQUE: ['DJ'],
  ASSISTANT_FINANCIER: ['DF'],
};

const getAssistantDirectionCodes = (role: string): string[] => ASSISTANT_DIRECTION_CODES_BY_ROLE[role] || [];

// Appliquer authentification sur toutes les routes
router.use(authenticate);

// Transitions de workflow autorisées par rôle
const WORKFLOW_TRANSITIONS: Record<string, { from: StatutCourrier[]; to: StatutCourrier; roles: string[] }> = {
  ENTREE_DG: {
    from: ['RECU'],
    to: 'ENTREE_DG',
    roles: ['SECRETAIRE_DG', 'SECRETAIRE_ADMIN', 'SECRETAIRE_ADMIN_ADJ', 'ADMIN'],
  },
  SORTIE_DG: {
    from: ['ENTREE_DG'],
    to: 'SORTIE_DG',
    roles: ['SECRETAIRE_DG', 'SECRETAIRE_ADMIN', 'SECRETAIRE_ADMIN_ADJ', 'ADMIN'],
  },
  ENTREE_DGA: {
    from: ['SORTIE_DG'],
    to: 'ENTREE_DGA',
    roles: ['SECRETAIRE_DGA', 'SECRETAIRE_ADMIN', 'SECRETAIRE_ADMIN_ADJ', 'ADMIN'],
  },
  SORTIE_DGA: {
    from: ['ENTREE_DGA'],
    to: 'SORTIE_DGA',
    roles: ['SECRETAIRE_DGA', 'SECRETAIRE_ADMIN', 'SECRETAIRE_ADMIN_ADJ', 'ADMIN'],
  },
  ORIENTE: {
    from: ['RECU', 'SORTIE_DG', 'SORTIE_DGA', 'ORIENTE'],
    to: 'ORIENTE',
    roles: ['SECRETAIRE_ADMIN', 'SECRETAIRE_ADMIN_ADJ', 'PROTOCOLE'],
  },
  RECU_DIRECTION: {
    from: ['ORIENTE'],
    to: 'RECU_DIRECTION',
    roles: ['DIRECTEUR', 'SECRETAIRE_DIRECTION', 'ADMIN'],
  },
  RETOUR: {
    from: ['RECU_DIRECTION', 'EN_TRAITEMENT'],
    to: 'RETOUR',
    roles: [
      'DIRECTEUR',
      'SECRETAIRE_DIRECTION',
      'SECRETAIRE_ADMIN',
      'SECRETAIRE_ADMIN_ADJ',
      'DG',
      'DGA',
      'ASSISTANT_TECHNIQUE',
      'ASSISTANT_JURIDIQUE',
      'ASSISTANT_FINANCIER',
      'ADMIN',
    ],
  },
  ENTREE_DG_RETOUR: {
    from: ['RETOUR'],
    to: 'ENTREE_DG_RETOUR',
    roles: ['SECRETAIRE_ADMIN', 'SECRETAIRE_ADMIN_ADJ', 'ADMIN'],
  },
  SORTIE_DG_RETOUR: {
    from: ['ENTREE_DG_RETOUR'],
    to: 'SORTIE_DG_RETOUR',
    roles: ['SECRETAIRE_ADMIN', 'SECRETAIRE_ADMIN_ADJ', 'ADMIN'],
  },
  ENTREE_DGA_RETOUR: {
    from: ['SORTIE_DG_RETOUR'],
    to: 'ENTREE_DGA_RETOUR',
    roles: ['SECRETAIRE_ADMIN', 'SECRETAIRE_ADMIN_ADJ', 'ADMIN'],
  },
  SORTIE_DGA_RETOUR: {
    from: ['ENTREE_DGA_RETOUR'],
    to: 'SORTIE_DGA_RETOUR',
    roles: ['SECRETAIRE_ADMIN', 'SECRETAIRE_ADMIN_ADJ', 'ADMIN'],
  },
  SORTANT_ENREGISTRE: {
    from: ['SORTIE_DGA_RETOUR'],
    to: 'SORTANT_ENREGISTRE',
    roles: ['COURRIER_SORTANT', 'SECRETAIRE_ADMIN', 'SECRETAIRE_ADMIN_ADJ', 'ADMIN'],
  },
  SORTANT_ENVOYE: {
    from: ['SORTANT_ENREGISTRE'],
    to: 'SORTANT_ENVOYE',
    roles: ['COURRIER_SORTANT', 'ADMIN'],
  },
  CLASSE: {
    from: ['SORTANT_ENVOYE'],
    to: 'CLASSE',
    roles: ['SECRETAIRE_ADMIN', 'ADMIN'],
  },
};

// Helper: log audit
const logAudit = async (userId: number, action: string, tableName: string, recordId: number) => {
  await query(
    'INSERT INTO audit_logs (user_id, action, table_name, record_id) VALUES ($1, $2, $3, $4)',
    [userId, action, tableName, recordId]
  );
};

// Helper: notifier utilisateurs selon rôles
const notifyUsers = async (
  courrierRef: string,
  message: string,
  roles: string[],
  courrierId?: number,
  type: string = 'INFO'
) => {
  if (roles.length === 0) return;
  const placeholders = roles.map((_, i) => `$${i + 1}`).join(', ');
  const usersResult = await query(
    `SELECT u.id FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name IN (${placeholders}) AND u.is_active = TRUE`,
    roles
  );
  for (const u of usersResult.rows) {
    if (courrierId) {
      await query(
        'INSERT INTO notifications (user_id, courrier_id, message, type) VALUES ($1, $2, $3, $4)',
        [u.id, courrierId, `Courrier ${courrierRef} : ${message}`, type]
      );
    } else {
      await query(
        'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
        [u.id, `Courrier ${courrierRef} : ${message}`, type]
      );
    }
  }
};

const notifyAssistantsForDirection = async (
  directionCode: string | null | undefined,
  courrierRef: string,
  message: string,
  courrierId?: number,
  type: string = 'INFO'
) => {
  if (!directionCode) return;

  const matchingRoles = Object.entries(ASSISTANT_DIRECTION_CODES_BY_ROLE)
    .filter(([, codes]) => codes.includes(directionCode))
    .map(([roleName]) => roleName);

  if (matchingRoles.length === 0) return;

  await notifyUsers(courrierRef, message, matchingRoles, courrierId, type);
};

// GET /api/courriers — Liste avec filtres et visibilité selon rôle
router.get(
  '/',
  [
    queryParam('statut').optional().isString(),
    queryParam('direction_id').optional().isInt(),
    queryParam('page').optional().isInt({ min: 1 }),
    queryParam('limit').optional().isInt({ min: 1, max: 100 }),
    queryParam('search').optional().isString(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { statut, direction_id, search, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    try {
      const role = req.user!.role;
      const userDirId = req.user!.directionId;
      const assistantDirectionCodes = getAssistantDirectionCodes(role);

      const whereConditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      // Visibilité :
      // - Profils globaux : tous les courriers
      // - Assistants : uniquement leur périmètre directionnel (DT, DJ, DF)
      // - Autres non-globaux : uniquement leur direction
      if (assistantDirectionCodes.length > 0) {
        whereConditions.push(`c.direction_id IN (SELECT d.id FROM directions d WHERE d.code = ANY($${paramIndex}))`);
        params.push(assistantDirectionCodes);
        paramIndex++;
      } else if (!ROLES_GLOBAUX.includes(role)) {
        // Tout profil non global est forcément rattaché à une direction
        whereConditions.push(`c.direction_id = $${paramIndex}`);
        params.push(userDirId);
        paramIndex++;
      }

      if (statut) {
        whereConditions.push(`c.statut = $${paramIndex}`);
        params.push(statut);
        paramIndex++;
      }

      if (direction_id) {
        whereConditions.push(`c.direction_id = $${paramIndex}`);
        params.push(parseInt(direction_id as string));
        paramIndex++;
      }

      if (search) {
        const likeSearch = `%${search}%`;
        whereConditions.push(
          `(
            c.reference ILIKE $${paramIndex}
            OR c.numero ILIKE $${paramIndex}
            OR c.objet ILIKE $${paramIndex}
            OR c.expediteur ILIKE $${paramIndex}
            OR EXISTS (
              SELECT 1
              FROM courriers_sortants cs
              WHERE cs.courrier_id = c.id
                AND cs.numero_sortant ILIKE $${paramIndex}
            )
            OR EXISTS (
              SELECT 1
              FROM pieces_jointes pj
              WHERE pj.courrier_id = c.id
                AND (
                  to_tsvector('simple', COALESCE(pj.extracted_text, '')) @@ plainto_tsquery('simple', $${paramIndex + 1})
                  OR pj.extracted_text ILIKE $${paramIndex}
                )
            )
          )`
        );
        params.push(likeSearch, String(search));
        paramIndex += 2;
      }

      const where = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const countResult = await query(
        `SELECT COUNT(*) FROM courriers c ${where}`,
        params
      );

      const result = await query(
        `SELECT c.*, 
                u.fullname as created_by_name,
                d.name as direction_name,
                d.code as direction_code,
                r.name as role_name
         FROM courriers c
         LEFT JOIN users u ON c.created_by = u.id
         LEFT JOIN directions d ON c.direction_id = d.id
         LEFT JOIN roles r ON u.role_id = r.id
         ${where}
         ORDER BY c.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, parseInt(limit as string), offset]
      );

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].count),
          page: parseInt(page as string),
          limit: parseInt(limit as string),
        },
      });
    } catch (error) {
      console.error('Erreur GET /courriers:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/courriers/stats — Statistiques dashboard
router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.user!.role;
    const userDirId = req.user!.directionId;
    const assistantDirectionCodes = getAssistantDirectionCodes(role);

    // Pour les assistants, filtre sur les directions de rattachement métier (DT, DJ, DF).
    // Pour les autres non-globaux, filtre sur leur direction affectée.
    const dirFilter = assistantDirectionCodes.length > 0
      ? `WHERE direction_id IN (SELECT id FROM directions WHERE code IN ('${assistantDirectionCodes.join("','")}'))`
      : !ROLES_GLOBAUX.includes(role) && userDirId
      ? `WHERE direction_id = ${parseInt(String(userDirId))}`
      : '';

    const statsResult = await query(`
      SELECT
        COUNT(*) FILTER (WHERE type_courrier = 'ENTRANT') as total_entrants,
        COUNT(*) FILTER (WHERE type_courrier = 'SORTANT') as total_sortants,
        COUNT(*) FILTER (WHERE statut = 'RECU') as en_attente,
        COUNT(*) FILTER (WHERE statut IN ('ENTREE_DGA','SORTIE_DGA','ENTREE_DG','SORTIE_DG','ORIENTE','RECU_DIRECTION','EN_TRAITEMENT')) as en_cours,
        COUNT(*) FILTER (WHERE statut IN ('SORTANT_ENVOYE','CLASSE')) as traites,
        COUNT(*) FILTER (WHERE date_reception = CURRENT_DATE) as recu_aujourd_hui
      FROM courriers
      ${dirFilter}
    `);

    const parStatutResult = await query(`
      SELECT statut, COUNT(*) as count
      FROM courriers
      ${dirFilter}
      GROUP BY statut
      ORDER BY count DESC
    `);

    const parDirectionResult = await query(`
      SELECT d.name, COUNT(c.id) as count
      FROM directions d
      LEFT JOIN courriers c ON d.id = c.direction_id ${assistantDirectionCodes.length > 0
        ? `AND c.direction_id IN (SELECT id FROM directions WHERE code IN ('${assistantDirectionCodes.join("','")}'))`
        : !ROLES_GLOBAUX.includes(role) && userDirId
        ? `AND c.direction_id = ${parseInt(String(userDirId))}`
        : ''}
      GROUP BY d.id, d.name
      ORDER BY count DESC
    `);

    const mensuelleFilter = assistantDirectionCodes.length > 0
      ? `WHERE direction_id IN (SELECT id FROM directions WHERE code IN ('${assistantDirectionCodes.join("','")}')) AND date_reception >= NOW() - INTERVAL '12 months'`
      : !ROLES_GLOBAUX.includes(role) && userDirId
      ? `WHERE direction_id = ${parseInt(String(userDirId))} AND date_reception >= NOW() - INTERVAL '12 months'`
      : `WHERE date_reception >= NOW() - INTERVAL '12 months'`;

    const evolutionMensuelleResult = await query(`
      SELECT
        TO_CHAR(date_reception, 'YYYY-MM') as mois,
        COUNT(*) FILTER (WHERE type_courrier = 'ENTRANT') as entrants,
        COUNT(*) FILTER (WHERE type_courrier = 'SORTANT') as sortants
      FROM courriers
      ${mensuelleFilter}
      GROUP BY mois
      ORDER BY mois ASC
    `);

    res.json({
      success: true,
      stats: statsResult.rows[0],
      parStatut: parStatutResult.rows,
      parDirection: parDirectionResult.rows,
      evolutionMensuelle: evolutionMensuelleResult.rows,
    });
  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/courriers/:id — Détail avec tracking
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const courrierResult = await query(
      `SELECT c.*,
              u.fullname as created_by_name,
              d.name as direction_name,
              d.code as direction_code
       FROM courriers c
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN directions d ON c.direction_id = d.id
       WHERE c.id = $1`,
      [id]
    );

    if (courrierResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Courrier introuvable' });
      return;
    }

    const courrier = courrierResult.rows[0];
    const role = req.user!.role;
    const userDirId = req.user!.directionId;
    const assistantDirectionCodes = getAssistantDirectionCodes(role);

    // Contrôle de visibilité :
    // - Assistants : uniquement leurs directions de suivi
    // - Autres non-globaux : uniquement leur direction
    if (assistantDirectionCodes.length > 0) {
      const allowedDirectionResult = await query(
        'SELECT id FROM directions WHERE id = $1 AND code = ANY($2)',
        [courrier.direction_id, assistantDirectionCodes]
      );
      if (allowedDirectionResult.rows.length === 0) {
        res.status(403).json({ success: false, message: 'Accès refusé : ce courrier n\'est pas dans votre périmètre assistant' });
        return;
      }
    } else if (!ROLES_GLOBAUX.includes(role)) {
      if (courrier.direction_id !== userDirId) {
        res.status(403).json({ success: false, message: 'Accès refusé : ce courrier n\'appartient pas à votre direction' });
        return;
      }
    }

    // Historique tracking
    const trackingResult = await query(
      `SELECT ct.*, u.fullname as acteur_name
       FROM courriers_tracking ct
       LEFT JOIN users u ON ct.acteur_id = u.id
       WHERE ct.courrier_id = $1
       ORDER BY ct.date_action ASC`,
      [id]
    );

    // Pièces jointes
    const pjResult = await query(
      `SELECT pj.*, u.fullname as uploaded_by_name
       FROM pieces_jointes pj
       LEFT JOIN users u ON pj.uploaded_by = u.id
       WHERE pj.courrier_id = $1`,
      [id]
    );

    // Courrier sortant lié
    const sortantResult = await query(
      'SELECT * FROM courriers_sortants WHERE courrier_id = $1',
      [id]
    );

    res.json({
      success: true,
      courrier,
      tracking: trackingResult.rows,
      piecesJointes: pjResult.rows,
      sortant: sortantResult.rows[0] || null,
    });
  } catch (error) {
    console.error('Erreur GET /courriers/:id:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/courriers — Créer un courrier entrant
router.post(
  '/',
  requireRole(
    'COURRIER_ENTRANT',
    'COURRIER_SORTANT',
    'SECRETAIRE_ADMIN',
    'SECRETAIRE_ADMIN_ADJ',
    'SECRETAIRE_DG',
    'SECRETAIRE_DGA',
    'ADMIN'
  ),
  [
    body('objet').notEmpty().withMessage('Objet requis'),
    body('expediteur').notEmpty().withMessage('Expéditeur requis'),
    body('reference').optional().isString(),
    body('numero').optional().isString(),
    body('nombre_annexes').optional().isInt({ min: 0 }).withMessage('Le nombre d\'annexes doit être un entier positif ou nul'),
    body('date_reception').optional().isISO8601().withMessage('Format date invalide'),
    body('priorite').optional().isIn(['NORMALE', 'URGENTE', 'CONFIDENTIELLE']),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { objet, expediteur, reference, numero, nombre_annexes, date_reception, priorite = 'NORMALE', notes } = req.body;

    const annexesCount = typeof nombre_annexes === 'undefined' || nombre_annexes === ''
      ? 0
      : parseInt(String(nombre_annexes), 10);

    try {
      const result = await query(
        `INSERT INTO courriers (objet, expediteur, reference, numero, nombre_annexes, date_reception, priorite, notes, created_by, statut, type_courrier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'RECU', 'ENTRANT')
         RETURNING *`,
        [objet, expediteur, reference, numero || null, annexesCount, date_reception || new Date(), priorite, notes, req.user!.userId]
      );

      const courrier = result.rows[0];

      // Tracking initial
      await query(
        `INSERT INTO courriers_tracking (courrier_id, action, acteur_id, role, statut_avant, statut_apres)
         VALUES ($1, 'RECEPTION', $2, $3, NULL, 'RECU')`,
        [courrier.id, req.user!.userId, req.user!.role]
      );

      await logAudit(req.user!.userId, 'CREATE_COURRIER', 'courriers', courrier.id);

      // Notifier les profils globaux
      await notifyUsers(
        courrier.reference || `#${courrier.id}`,
        'Nouveau courrier reçu',
        ['SECRETAIRE_ADMIN', 'SECRETAIRE_ADMIN_ADJ', 'SECRETAIRE_DG', 'SECRETAIRE_DGA']
      );

      res.status(201).json({ success: true, courrier });
    } catch (error) {
      console.error('Erreur POST /courriers:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// POST /api/courriers/:id/workflow — Avancer dans le workflow
router.post(
  '/:id/workflow',
  [
    body('action').notEmpty().withMessage('Action requise'),
    body('commentaire').optional().isString(),
    body('direction_id').optional().isInt(),
    body('numero_sortant').optional().isString(),
    body('destinataire').optional().isString(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { id } = req.params;
    const { action, commentaire, direction_id, numero_sortant, destinataire } = req.body;

    const transition = WORKFLOW_TRANSITIONS[action as string];
    if (!transition) {
      res.status(400).json({ success: false, message: `Action '${action}' inconnue` });
      return;
    }

    const role = req.user!.role;
    const userDirId = req.user!.directionId;
    const assistantDirectionCodes = getAssistantDirectionCodes(role);

    if (!transition.roles.includes(role)) {
      res.status(403).json({
        success: false,
        message: `Rôle '${role}' non autorisé pour l'action '${action}'`,
      });
      return;
    }

    if (action === 'ORIENTE' && !direction_id) {
      res.status(400).json({
        success: false,
        message: 'Une direction est requise pour orienter le courrier',
      });
      return;
    }

    try {
      const courrierResult = await query(
        `SELECT c.*, d.name as direction_name, d.code as direction_code
         FROM courriers c
         LEFT JOIN directions d ON d.id = c.direction_id
         WHERE c.id = $1`,
        [id]
      );
      if (courrierResult.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Courrier introuvable' });
        return;
      }

      const courrier = courrierResult.rows[0];

      // Contrôle de périmètre :
      // - Assistants : uniquement leurs directions rattachées
      // - Autres non-globaux : uniquement leur direction d'affectation
      if (assistantDirectionCodes.length > 0) {
        if (!courrier.direction_code || !assistantDirectionCodes.includes(courrier.direction_code)) {
          res.status(403).json({ success: false, message: 'Accès refusé : action hors de votre périmètre assistant' });
          return;
        }
      } else if (!ROLES_GLOBAUX.includes(role) && courrier.direction_id !== userDirId) {
        res.status(403).json({ success: false, message: 'Accès refusé : ce courrier n\'appartient pas à votre direction' });
        return;
      }

      if (action === 'ORIENTE' && direction_id) {
        const directionResult = await query('SELECT id FROM directions WHERE id = $1', [direction_id]);
        if (directionResult.rows.length === 0) {
          res.status(400).json({ success: false, message: 'Direction invalide' });
          return;
        }
      }

      if (!transition.from.includes(courrier.statut)) {
        res.status(400).json({
          success: false,
          message: `Transition invalide : statut actuel '${courrier.statut}' ne permet pas '${action}'`,
        });
        return;
      }

      // Cas ORIENTE : mettre à jour la direction
      let updateQuery = `UPDATE courriers SET statut = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`;
      let updateParams: unknown[] = [transition.to, id];

      if (action === 'ORIENTE' && direction_id) {
        updateQuery = `UPDATE courriers SET statut = $1, direction_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`;
        updateParams = [transition.to, direction_id, id];
      }

      const updated = await query(updateQuery, updateParams);

      // Tracking
      await query(
        `INSERT INTO courriers_tracking (courrier_id, action, acteur_id, role, statut_avant, statut_apres, commentaire)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, action, req.user!.userId, role, courrier.statut, transition.to, commentaire]
      );

      // Action RECU_DIRECTION : synchroniser secrétaire ET directeur
      if (action === 'RECU_DIRECTION') {
        // Notifier l'autre acteur de la direction
        const dirId = courrier.direction_id;
        if (dirId) {
          const otherRole = role === 'DIRECTEUR' ? 'SECRETAIRE_DIRECTION' : 'DIRECTEUR';
          const otherUsers = await query(
            `SELECT u.id FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE r.name = $1 AND u.direction_id = $2 AND u.is_active = TRUE`,
            [otherRole, dirId]
          );
          for (const u of otherUsers.rows) {
            await query(
              'INSERT INTO notifications (user_id, courrier_id, message, type) VALUES ($1, $2, $3, $4)',
              [u.id, id, `Le courrier a été réceptionné par votre direction`, 'INFO']
            );
          }
        }

        // Notifier les profils principaux que la direction a accusé réception
        await notifyUsers(
          courrier.reference || `#${courrier.id}`,
          `Accusé de réception confirmé par la direction ${courrier.direction_name || ''}`.trim(),
          ['ADMIN', 'DG', 'DGA', 'PROTOCOLE', 'SECRETAIRE_ADMIN', 'SECRETAIRE_ADMIN_ADJ', 'SECRETAIRE_DG', 'SECRETAIRE_DGA'],
          courrier.id,
          'SUCCESS'
        );

        await notifyAssistantsForDirection(
          courrier.direction_code,
          courrier.reference || `#${courrier.id}`,
          `Accusé de réception confirmé par la direction ${courrier.direction_name || ''}`.trim(),
          courrier.id,
          'SUCCESS'
        );
      }

      if (action === 'RETOUR') {
        // Notifier les profils principaux que le traitement est terminé côté direction
        await notifyUsers(
          courrier.reference || `#${courrier.id}`,
          `Fin de traitement signalée par la direction ${courrier.direction_name || ''}`.trim(),
          ['ADMIN', 'DG', 'DGA', 'PROTOCOLE', 'SECRETAIRE_ADMIN', 'SECRETAIRE_ADMIN_ADJ', 'SECRETAIRE_DG', 'SECRETAIRE_DGA'],
          courrier.id,
          'SUCCESS'
        );

        await notifyAssistantsForDirection(
          courrier.direction_code,
          courrier.reference || `#${courrier.id}`,
          `Fin de traitement signalée par la direction ${courrier.direction_name || ''}`.trim(),
          courrier.id,
          'SUCCESS'
        );
      }

      // Cas SORTANT_ENREGISTRE
      if (action === 'SORTANT_ENREGISTRE' && numero_sortant) {
        await query(
          `INSERT INTO courriers_sortants (courrier_id, numero_sortant, destinataire)
           VALUES ($1, $2, $3)`,
          [id, numero_sortant, destinataire]
        );
        await query(
          `UPDATE courriers SET type_courrier = 'SORTANT' WHERE id = $1`,
          [id]
        );
      }

      await logAudit(req.user!.userId, `WORKFLOW_${action}`, 'courriers', parseInt(id));

      res.json({
        success: true,
        message: `Action '${action}' effectuée avec succès`,
        courrier: updated.rows[0],
      });
    } catch (error) {
      console.error('Erreur workflow:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// POST /api/courriers/:id/sortant/confirmer — Confirmation dépôt courrier sortant
router.post(
  '/:id/sortant/confirmer',
  requireRole('COURRIER_SORTANT', 'PROTOCOLE', 'ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const result = await query(
        `UPDATE courriers_sortants
         SET confirme = TRUE, date_confirmation = CURRENT_TIMESTAMP, confirme_par = $1
         WHERE courrier_id = $2 RETURNING *`,
        [req.user!.userId, id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Courrier sortant introuvable' });
        return;
      }

      await query(
        `UPDATE courriers SET statut = 'SORTANT_ENVOYE' WHERE id = $1`,
        [id]
      );

      await query(
        `INSERT INTO courriers_tracking (courrier_id, action, acteur_id, role, statut_avant, statut_apres)
         VALUES ($1, 'CONFIRMATION_DEPOT', $2, $3, 'SORTANT_ENREGISTRE', 'SORTANT_ENVOYE')`,
        [id, req.user!.userId, req.user!.role]
      );

      res.json({ success: true, message: 'Dépôt confirmé', sortant: result.rows[0] });
    } catch (error) {
      console.error('Erreur confirmation sortant:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// POST /api/courriers/:id/upload — Upload pièce jointe
router.post('/:id/upload', async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!req.files || !req.files.file) {
    res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    return;
  }

  const file = req.files.file as { name: string; size: number; mimetype: string; mv: (path: string, cb: (err: unknown) => void) => void };
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

  if (!allowedTypes.includes(file.mimetype)) {
    res.status(400).json({ success: false, message: 'Type de fichier non autorisé (PDF, JPG, PNG uniquement)' });
    return;
  }

  const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760');
  if (file.size > maxSize) {
    res.status(400).json({ success: false, message: 'Fichier trop volumineux (max 10 MB)' });
    return;
  }

  try {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const fileName = `${Date.now()}_${path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(uploadDir, fileName);

    await new Promise<void>((resolve, reject) => {
      file.mv(filePath, (err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const result = await query(
      `INSERT INTO pieces_jointes (courrier_id, file_name, file_path, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, file.name, fileName, file.size, file.mimetype, req.user!.userId]
    );

    const pieceJointe = result.rows[0] as { id: number };

    // L'OCR est poussé dans une file persistée pour retries et robustesse.
    await enqueueOcrJob(pieceJointe.id);

    res.json({ success: true, pieceJointe: result.rows[0] });
  } catch (error) {
    console.error('Erreur upload:', error);
    res.status(500).json({ success: false, message: 'Erreur upload' });
  }
});

// PUT /api/courriers/:id — Modifier les données d'un courrier
router.put(
  '/:id',
  requireRole('COURRIER_ENTRANT', 'COURRIER_SORTANT', 'SECRETAIRE_ADMIN', 'SECRETAIRE_ADMIN_ADJ', 'SECRETAIRE_DG', 'SECRETAIRE_DGA', 'ADMIN'),
  [
    body('objet').notEmpty().withMessage('Objet requis'),
    body('expediteur').notEmpty().withMessage('Expéditeur requis'),
    body('reference').optional({ nullable: true }).isString(),
    body('numero').optional({ nullable: true }).isString(),
    body('nombre_annexes').optional({ nullable: true }).isInt({ min: 0 }).withMessage('Le nombre d\'annexes doit être un entier positif ou nul'),
    body('date_reception').isISO8601().withMessage('Format date invalide'),
    body('priorite').isIn(['NORMALE', 'URGENTE', 'CONFIDENTIELLE']).withMessage('Priorité invalide'),
    body('notes').optional({ nullable: true }).isString(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { id } = req.params;
    try {
      const courrierResult = await query('SELECT * FROM courriers WHERE id = $1', [id]);
      if (courrierResult.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Courrier introuvable' });
        return;
      }

      const courrier = courrierResult.rows[0];
      const { objet, expediteur, reference, numero, nombre_annexes, date_reception, priorite, notes } = req.body;

      const annexesCount = (nombre_annexes === undefined || nombre_annexes === null || nombre_annexes === '')
        ? 0
        : parseInt(String(nombre_annexes), 10);

      // Construire le résumé des changements pour le tracking
      const changes: string[] = [];
      if (objet !== courrier.objet) changes.push(`Objet: "${courrier.objet}" → "${objet}"`);
      if (expediteur !== courrier.expediteur) changes.push(`Expéditeur: "${courrier.expediteur}" → "${expediteur}"`);
      if ((reference || null) !== courrier.reference) changes.push('Référence modifiée');
      if ((numero || null) !== courrier.numero) changes.push('Numéro modifié');
      if (annexesCount !== courrier.nombre_annexes) changes.push(`Annexes: ${courrier.nombre_annexes} → ${annexesCount}`);
      if (priorite !== courrier.priorite) changes.push(`Priorité: ${courrier.priorite} → ${priorite}`);
      if ((notes || null) !== courrier.notes) changes.push('Notes modifiées');
      const commentaire = changes.length > 0 ? changes.join(' | ') : 'Données mises à jour (aucun changement détecté)';

      const updated = await query(
        `UPDATE courriers SET
           objet = $1,
           expediteur = $2,
           reference = $3,
           numero = $4,
           nombre_annexes = $5,
           date_reception = $6,
           priorite = $7,
           notes = $8,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $9 RETURNING *`,
        [objet, expediteur, reference || null, numero || null, annexesCount, date_reception, priorite, notes || null, id]
      );

      await query(
        `INSERT INTO courriers_tracking (courrier_id, action, acteur_id, role, statut_avant, statut_apres, commentaire)
         VALUES ($1, 'MODIFICATION', $2, $3, $4, $4, $5)`,
        [id, req.user!.userId, req.user!.role, courrier.statut, commentaire]
      );

      await logAudit(req.user!.userId, 'UPDATE_COURRIER', 'courriers', parseInt(id));

      res.json({ success: true, courrier: updated.rows[0] });
    } catch (error) {
      console.error('Erreur PUT /courriers/:id:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// DELETE /api/courriers/bulk/all — Supprimer tous les courriers (admin uniquement)
router.delete(
  '/bulk/all',
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const countResult = await query('SELECT COUNT(*)::int as total FROM courriers');
      const total = countResult.rows[0]?.total || 0;

      if (total === 0) {
        res.json({ success: true, message: 'Aucun courrier à supprimer', deletedCount: 0 });
        return;
      }

      // Supprimer les fichiers physiques liés à toutes les pièces jointes
      const pjResult = await query('SELECT file_path FROM pieces_jointes');
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      for (const pj of pjResult.rows) {
        const filePath = path.join(uploadDir, pj.file_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Audit global avant suppression
      await query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id)
         VALUES ($1, $2, $3, $4)`,
        [req.user!.userId, 'DELETE_ALL_COURRIERS', 'courriers', null]
      );

      await query('DELETE FROM courriers');

      res.json({ success: true, message: `${total} courrier(s) supprimé(s) avec succès`, deletedCount: total });
    } catch (error) {
      console.error('Erreur DELETE /courriers/bulk/all:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// DELETE /api/courriers/:id — Supprimer un courrier (admin/hiérarchie uniquement)
router.delete(
  '/:id',
  requireRole('ADMIN', 'DG', 'DGA', 'SECRETAIRE_ADMIN', 'SECRETAIRE_ADMIN_ADJ'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const courrierResult = await query('SELECT * FROM courriers WHERE id = $1', [id]);
      if (courrierResult.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Courrier introuvable' });
        return;
      }

      // Supprimer les fichiers physiques liés
      const pjResult = await query('SELECT * FROM pieces_jointes WHERE courrier_id = $1', [id]);
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      for (const pj of pjResult.rows) {
        const filePath = path.join(uploadDir, pj.file_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Log audit avant suppression physique
      await logAudit(req.user!.userId, 'DELETE_COURRIER', 'courriers', parseInt(id));

      await query('DELETE FROM courriers WHERE id = $1', [id]);

      res.json({ success: true, message: 'Courrier supprimé avec succès' });
    } catch (error) {
      console.error('Erreur DELETE /courriers/:id:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// DELETE /api/courriers/pieces-jointes/:pieceId — Supprimer une pièce jointe
router.delete('/pieces-jointes/:pieceId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { pieceId } = req.params;

  try {
    const result = await query(
      'SELECT * FROM pieces_jointes WHERE id = $1',
      [pieceId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Pièce jointe introuvable' });
      return;
    }

    const piece = result.rows[0];
    const role = req.user!.role;
    const userId = req.user!.userId;

    // Seul l'auteur du fichier ou un admin peut supprimer
    if (piece.uploaded_by !== userId && role !== 'ADMIN') {
      res.status(403).json({ success: false, message: 'Non autorisé à supprimer ce fichier' });
      return;
    }

    // Supprimer le fichier physique
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filePath = path.join(uploadDir, piece.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await query('DELETE FROM pieces_jointes WHERE id = $1', [pieceId]);

    res.json({ success: true, message: 'Pièce jointe supprimée' });
  } catch (error) {
    console.error('Erreur suppression pièce jointe:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
