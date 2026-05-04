import { Response, Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin, requireGlobalAccess } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

// GET /api/directions
router.get('/', requireGlobalAccess, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT d.*, COUNT(u.id) as nb_utilisateurs
       FROM directions d
       LEFT JOIN users u ON d.id = u.direction_id AND u.is_active = TRUE
       WHERE d.is_active = TRUE
       GROUP BY d.id
       ORDER BY d.name`
    );
    res.json({ success: true, data: result.rows });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/directions
router.post(
  '/',
  requireAdmin,
  [
    body('name').notEmpty().withMessage('Nom de la direction requis'),
    body('code').optional().isString(),
    body('description').optional().isString(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { name, code, description } = req.body;

    try {
      const result = await query(
        'INSERT INTO directions (name, code, description) VALUES ($1, $2, $3) RETURNING *',
        [name, code, description]
      );
      res.status(201).json({ success: true, direction: result.rows[0] });
    } catch (_error) {
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/directions/:id
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, code, description, is_active } = req.body;

  try {
    const result = await query(
      'UPDATE directions SET name = $1, code = $2, description = $3, is_active = $4 WHERE id = $5 RETURNING *',
      [name, code, description, is_active ?? true, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Direction introuvable' });
      return;
    }
    res.json({ success: true, direction: result.rows[0] });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
