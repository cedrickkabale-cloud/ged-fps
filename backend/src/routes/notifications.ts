import { Response, Router } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/notifications — Notifications de l'utilisateur connecté
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT n.*, c.reference, c.objet
       FROM notifications n
       LEFT JOIN courriers c ON n.courrier_id = c.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [req.user!.userId]
    );

    const unreadCount = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user!.userId]
    );

    res.json({
      success: true,
      data: result.rows,
      unreadCount: parseInt(unreadCount.rows[0].count),
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/notifications/read-all — Marquer toutes comme lues
// IMPORTANT : cette route doit être déclarée AVANT /:id/read pour éviter que Express
// n'interprète "read-all" comme un paramètre :id.
router.put('/read-all', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
      [req.user!.userId]
    );
    res.json({ success: true });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/notifications/:id/read — Marquer comme lue
router.put('/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    await query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [id, req.user!.userId]
    );
    res.json({ success: true });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
