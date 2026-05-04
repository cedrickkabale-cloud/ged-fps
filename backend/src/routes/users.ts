import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Response, Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin, requireGlobalAccess } from '../middleware/rbac';
import { sendNewAccountCredentialsEmail } from '../services/mailer';

const router = Router();
router.use(authenticate);

const ASSISTANT_ROLES = [
  { name: 'ASSISTANT_TECHNIQUE', description: 'Assistant Technique - suivi Direction Technique' },
  { name: 'ASSISTANT_JURIDIQUE', description: 'Assistant Juridique - suivi Direction Juridique' },
  { name: 'ASSISTANT_FINANCIER', description: 'Assistant Financier - suivi Direction Financiere' },
  { name: 'PROTOCOLE', description: 'Protocole - distribution interne et suivi des validations de reception' },
];

const ASSISTANT_ROLE_NAMES = new Set(ASSISTANT_ROLES.map((role) => role.name));

const getAppUrl = () => process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

const ensureAssistantRoles = async () => {
  for (const role of ASSISTANT_ROLES) {
    await query(
      `INSERT INTO roles (name, description)
       VALUES ($1, $2)
       ON CONFLICT (name) DO NOTHING`,
      [role.name, role.description]
    );
  }
};

const getRoleNameById = async (roleId: number): Promise<string | null> => {
  const result = await query('SELECT name FROM roles WHERE id = $1', [roleId]);
  return result.rows[0]?.name || null;
};

const findDirectionGeneraleId = async (): Promise<number | null> => {
  const byCode = await query(
    `SELECT id
     FROM directions
     WHERE is_active = TRUE
       AND UPPER(COALESCE(code, '')) = 'DG'
     LIMIT 1`
  );
  if (byCode.rows.length > 0) return byCode.rows[0].id;

  const byName = await query(
    `SELECT id
     FROM directions
     WHERE is_active = TRUE
       AND TRANSLATE(UPPER(COALESCE(name, '')), 'ÉÈÊËÀÂÄÎÏÔÖÛÜÙÇ', 'EEEEAAAIIOOUUUC') LIKE '%DIRECTION GENERALE%'
       AND TRANSLATE(UPPER(COALESCE(name, '')), 'ÉÈÊËÀÂÄÎÏÔÖÛÜÙÇ', 'EEEEAAAIIOOUUUC') NOT LIKE '%ADJOINTE%'
     LIMIT 1`
  );

  return byName.rows.length > 0 ? byName.rows[0].id : null;
};

const resolveDirectionGeneraleId = async (): Promise<number> => {
  const existingId = await findDirectionGeneraleId();
  if (existingId) return existingId;

  const created = await query(
    `INSERT INTO directions (name, code, description, is_active)
     VALUES ('Direction Générale', 'DG', 'Direction générale institutionnelle', TRUE)
     ON CONFLICT (code)
     DO UPDATE SET is_active = TRUE
     RETURNING id`
  );

  return created.rows[0].id;
};

// GET /api/users — Liste des utilisateurs (Admin seulement)
router.get('/', requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT u.id, u.fullname, u.email, u.is_active, u.created_at, u.last_login,
              r.name as role_name, r.id as role_id,
              d.name as direction_name, d.id as direction_id
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN directions d ON u.direction_id = d.id
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erreur GET /users:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/users/roles — Liste des rôles
router.get('/roles', requireGlobalAccess, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ensureAssistantRoles();
    const result = await query('SELECT * FROM roles ORDER BY id');
    res.json({ success: true, data: result.rows });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/users — Créer un utilisateur
router.post(
  '/',
  requireAdmin,
  [
    body('fullname').notEmpty().withMessage('Nom complet requis'),
    body('email').isEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 6 }).withMessage('Mot de passe min 6 caractères'),
    body('role_id').isInt().withMessage('Rôle requis'),
    body('direction_id').optional().isInt(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { fullname, email, password, role_id, direction_id } = req.body;

    try {
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        res.status(409).json({ success: false, message: 'Email déjà utilisé' });
        return;
      }

      const roleName = await getRoleNameById(role_id);
      if (!roleName) {
        res.status(400).json({ success: false, message: 'Role invalide' });
        return;
      }

      let resolvedDirectionId = direction_id || null;
      if (ASSISTANT_ROLE_NAMES.has(roleName)) {
        const directionGeneraleId = await resolveDirectionGeneraleId();
        resolvedDirectionId = directionGeneraleId;
      }

      const hashed = await bcrypt.hash(password, 12);
      const result = await query(
        `INSERT INTO users (fullname, email, password, role_id, direction_id, must_change_password)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         RETURNING id, fullname, email, role_id, direction_id, is_active, must_change_password, created_at`,
        [fullname, email, hashed, role_id, resolvedDirectionId]
      );

      let credentialsEmailSent = false;
      try {
        await sendNewAccountCredentialsEmail(email, fullname, password, getAppUrl());
        credentialsEmailSent = true;
      } catch (mailError) {
        // L'envoi email ne doit pas bloquer la création du compte.
        console.warn('⚠️ Email identifiants non envoyé (SMTP non configuré ou indisponible):', mailError);
      }

      await query(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id) VALUES ($1, $2, $3, $4)',
        [req.user!.userId, 'CREATE_USER', 'users', result.rows[0].id]
      );

      res.status(201).json({
        success: true,
        user: result.rows[0],
        credentialsEmailSent,
        message: credentialsEmailSent
          ? 'Utilisateur créé et identifiants envoyés par email.'
          : 'Utilisateur créé. Email d\'identifiants non envoyé (SMTP indisponible).',
      });
    } catch (error) {
      console.error('Erreur POST /users:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/users/:id — Modifier un utilisateur
router.put(
  '/:id',
  requireAdmin,
  [
    body('fullname').optional().notEmpty(),
    body('email').optional().isEmail(),
    body('role_id').optional().isInt(),
    body('direction_id').optional({ nullable: true }).isInt(),
    body('is_active').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { id } = req.params;
    const { fullname, email, role_id, direction_id, is_active } = req.body;

    try {
      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      const targetResult = await query('SELECT id, email, role_id, direction_id FROM users WHERE id = $1', [id]);
      if (targetResult.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
        return;
      }

      const currentUser = targetResult.rows[0];
      const effectiveRoleId = role_id !== undefined ? role_id : currentUser.role_id;
      const effectiveRoleName = await getRoleNameById(effectiveRoleId);

      if (!effectiveRoleName) {
        res.status(400).json({ success: false, message: 'Role invalide' });
        return;
      }

      let effectiveDirectionId = direction_id !== undefined ? direction_id : currentUser.direction_id;
      const isAssistantRole = ASSISTANT_ROLE_NAMES.has(effectiveRoleName);
      if (isAssistantRole) {
        const directionGeneraleId = await resolveDirectionGeneraleId();
        effectiveDirectionId = directionGeneraleId;
      }

      if (fullname !== undefined) { fields.push(`fullname = $${idx++}`); values.push(fullname); }

      if (email !== undefined) {
        const existing = await query('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, id]);
        if (existing.rows.length > 0) {
          res.status(409).json({ success: false, message: 'Email déjà utilisé' });
          return;
        }
        fields.push(`email = $${idx++}`);
        values.push(email);
      }

      if (role_id !== undefined) { fields.push(`role_id = $${idx++}`); values.push(role_id); }
      if (direction_id !== undefined || isAssistantRole) {
        fields.push(`direction_id = $${idx++}`);
        values.push(effectiveDirectionId);
      }
      if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }

      if (fields.length === 0) {
        res.status(400).json({ success: false, message: 'Aucun champ à modifier' });
        return;
      }

      values.push(id);
      const result = await query(
        `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING id, fullname, email, is_active`,
        values
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
        return;
      }

      await query(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id) VALUES ($1, $2, $3, $4)',
        [req.user!.userId, 'UPDATE_USER', 'users', parseInt(id)]
      );

      res.json({ success: true, user: result.rows[0] });
    } catch (error) {
      console.error('Erreur PUT /users/:id:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// DELETE /api/users/:id — Supprimer définitivement le compte
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const targetUserId = parseInt(id);

  if (targetUserId === req.user!.userId) {
    res.status(400).json({ success: false, message: 'Impossible de supprimer votre propre compte' });
    return;
  }

  try {
    const targetResult = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (targetResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
      return;
    }

    // Journaliser avant suppression pour garder la trace même après disparition du compte.
    await query(
      'INSERT INTO audit_logs (user_id, action, table_name, record_id) VALUES ($1, $2, $3, $4)',
      [req.user!.userId, 'DELETE_USER', 'users', targetUserId]
    );

    await query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ success: true, message: 'Compte utilisateur supprimé définitivement' });
  } catch (error) {
    console.error('Erreur DELETE /users/:id:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PATCH /api/users/:id/status — Suspendre / Réactiver un compte
router.patch(
  '/:id/status',
  requireAdmin,
  [body('action').isIn(['suspend', 'activate']).withMessage('Action invalide')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { id } = req.params;
    const { action } = req.body as { action: 'suspend' | 'activate' };

    if (parseInt(id) === req.user!.userId && action === 'suspend') {
      res.status(400).json({ success: false, message: 'Impossible de suspendre votre propre compte' });
      return;
    }

    try {
      const targetResult = await query('SELECT id, is_active FROM users WHERE id = $1', [id]);
      if (targetResult.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
        return;
      }

      const shouldBeActive = action === 'activate';
      await query('UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
        shouldBeActive,
        id,
      ]);

      await query(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id) VALUES ($1, $2, $3, $4)',
        [req.user!.userId, shouldBeActive ? 'ACTIVATE_USER' : 'SUSPEND_USER', 'users', parseInt(id)]
      );

      res.json({
        success: true,
        message: shouldBeActive ? 'Utilisateur réactivé' : 'Utilisateur suspendu',
      });
    } catch (error) {
      console.error('Erreur PATCH /users/:id/status:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/users/:id/history — Historique des actions admin sur un utilisateur
router.get('/:id/history', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const adminActions = [
    'CREATE_USER',
    'UPDATE_USER',
    'RESET_USER_PASSWORD',
    'SUSPEND_USER',
    'ACTIVATE_USER',
    'DELETE_USER',
    'SOFT_DELETE_USER',
  ];

  try {
    const targetResult = await query('SELECT id, fullname, email FROM users WHERE id = $1', [id]);
    if (targetResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
      return;
    }

    const historyResult = await query(
      `SELECT a.id,
              a.action,
              a.created_at,
              a.ip_address,
              actor.fullname as actor_name,
              actor.email as actor_email
       FROM audit_logs a
       LEFT JOIN users actor ON actor.id = a.user_id
       WHERE a.table_name = 'users'
         AND a.record_id = $1
         AND a.action = ANY($2)
       ORDER BY a.created_at DESC
       LIMIT 200`,
      [id, adminActions]
    );

    res.json({
      success: true,
      target: targetResult.rows[0],
      history: historyResult.rows,
    });
  } catch (error) {
    console.error('Erreur GET /users/:id/history:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/users/:id/reset-password — Réinitialiser mot de passe
router.post(
  '/:id/reset-password',
  requireAdmin,
  [],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { id } = req.params;
    try {
      const targetResult = await query('SELECT id, fullname, email FROM users WHERE id = $1', [id]);
      if (targetResult.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
        return;
      }

      const targetUser = targetResult.rows[0] as { id: number; fullname: string; email: string };
      const nextPassword = `${crypto.randomBytes(6).toString('base64url')}A1!`;
      const hashed = await bcrypt.hash(nextPassword, 12);

      await query(
        'UPDATE users SET password = $1, must_change_password = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [hashed, id]
      );

      let credentialsEmailSent = false;
      try {
        await sendNewAccountCredentialsEmail(targetUser.email, targetUser.fullname, nextPassword, getAppUrl());
        credentialsEmailSent = true;
      } catch (mailError) {
        console.warn('⚠️ Email reset identifiants non envoyé (SMTP non configuré ou indisponible):', mailError);
      }

      await query(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id) VALUES ($1, $2, $3, $4)',
        [req.user!.userId, 'RESET_USER_PASSWORD', 'users', parseInt(id)]
      );

      res.json({
        success: true,
        credentialsEmailSent,
        message: credentialsEmailSent
          ? 'Mot de passe réinitialisé et envoyé par email. L\'utilisateur devra le changer à la prochaine connexion.'
          : 'Mot de passe réinitialisé. Email non envoyé (SMTP indisponible).',
      });
    } catch (error) {
      console.error('Erreur POST /users/:id/reset-password:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

export default router;
