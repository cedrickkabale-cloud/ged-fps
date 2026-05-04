import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Response, Router } from 'express';
import { body, validationResult } from 'express-validator';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { query } from '../db';
import { AuthRequest, authenticate } from '../middleware/auth';
import { sendPasswordResetEmail } from '../services/mailer';

const router = Router();

const hashResetToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const getAppUrl = () => process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').trim().toLowerCase().isEmail().withMessage('Email invalide'),
    body('password').notEmpty().withMessage('Mot de passe requis'),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { email, password } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();

    try {
      const result = await query(
        `SELECT u.*, r.name as role_name, d.name as direction_name
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         LEFT JOIN directions d ON u.direction_id = d.id
         WHERE u.email = $1 AND u.is_active = TRUE`,
        [normalizedEmail]
      );

      if (result.rows.length === 0) {
        res.status(401).json({ success: false, message: 'Identifiants incorrects' });
        return;
      }

      const user = result.rows[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        res.status(401).json({ success: false, message: 'Identifiants incorrects' });
        return;
      }

      // Mettre à jour last_login
      await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error('JWT_SECRET non configuré');

      const signOptions: SignOptions = {
        expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as SignOptions['expiresIn'],
      };

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role_name,
          directionId: user.direction_id,
        },
        secret,
        signOptions
      );

      // Audit log
      await query(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
        [user.id, 'LOGIN', 'users', user.id, req.ip]
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          fullname: user.fullname,
          email: user.email,
          role: user.role_name,
          directionId: user.direction_id,
          directionName: user.direction_name,
          mustChangePassword: Boolean(user.must_change_password),
        },
      });
    } catch (error) {
      console.error('Erreur login:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT u.id, u.fullname, u.email, u.is_active, u.created_at,
              u.must_change_password,
              r.name as role_name, d.name as direction_name, d.id as direction_id
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN directions d ON u.direction_id = d.id
       WHERE u.id = $1`,
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
      return;
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Erreur /me:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  [body('email').trim().toLowerCase().isEmail().withMessage('Email invalide')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { email } = req.body as { email: string };
    const genericResponse = {
      success: true,
      message: 'Si un compte existe pour cette adresse, un lien de réinitialisation a été envoyé.',
    };

    try {
      const result = await query(
        `SELECT id, fullname, email
         FROM users
         WHERE email = $1 AND is_active = TRUE`,
        [email.trim().toLowerCase()]
      );

      if (result.rows.length === 0) {
        res.json(genericResponse);
        return;
      }

      const user = result.rows[0] as { id: number; fullname: string; email: string };
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashResetToken(rawToken);

      await query(
        'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL',
        [user.id]
      );

      await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_ip, user_agent)
         VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '30 minutes', $3, $4)`,
        [user.id, tokenHash, req.ip, req.get('user-agent') || null]
      );

      const resetUrl = `${getAppUrl()}/reinitialiser-mot-de-passe?token=${rawToken}`;
      await sendPasswordResetEmail(user.email, user.fullname, resetUrl);

      await query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.id, 'REQUEST_PASSWORD_RESET', 'users', user.id, req.ip, req.get('user-agent') || null]
      );

      res.json(genericResponse);
    } catch (error) {
      console.error('Erreur forgot-password:', error);
      res.status(500).json({ success: false, message: 'Impossible de traiter la demande pour le moment.' });
    }
  }
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Jeton requis'),
    body('newPassword').isLength({ min: 8 }).withMessage('Mot de passe min 8 caractères'),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { token, newPassword } = req.body as { token: string; newPassword: string };

    try {
      const tokenHash = hashResetToken(token);
      const tokenResult = await query(
        `SELECT id, user_id
         FROM password_reset_tokens
         WHERE token_hash = $1
           AND used_at IS NULL
           AND expires_at > CURRENT_TIMESTAMP
         LIMIT 1`,
        [tokenHash]
      );

      if (tokenResult.rows.length === 0) {
        res.status(400).json({ success: false, message: 'Lien de réinitialisation invalide ou expiré.' });
        return;
      }

      const resetEntry = tokenResult.rows[0] as { id: number; user_id: number };
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await query(
        'UPDATE users SET password = $1, must_change_password = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [hashedPassword, resetEntry.user_id]
      );
      await query('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1', [resetEntry.id]);
      await query(
        'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL',
        [resetEntry.user_id]
      );

      await query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [resetEntry.user_id, 'RESET_PASSWORD_SELF_SERVICE', 'users', resetEntry.user_id, req.ip, req.get('user-agent') || null]
      );

      res.json({ success: true, message: 'Mot de passe réinitialisé avec succès.' });
    } catch (error) {
      console.error('Erreur reset-password:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// POST /api/auth/change-password
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 }).withMessage('Mot de passe min 6 caractères'),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    try {
      const result = await query('SELECT password FROM users WHERE id = $1', [req.user!.userId]);
      const user = result.rows[0];

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        res.status(400).json({ success: false, message: 'Mot de passe actuel incorrect' });
        return;
      }

      const hashed = await bcrypt.hash(newPassword, 12);
      await query(
        'UPDATE users SET password = $1, must_change_password = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [hashed, req.user!.userId]
      );

      res.json({ success: true, message: 'Mot de passe modifié avec succès' });
    } catch (error) {
      console.error('Erreur change-password:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

export default router;
