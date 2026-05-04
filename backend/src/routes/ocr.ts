import { Response, Router } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';
import { retryAllFailedOcrJobs, retryOcrJobById } from '../services/ocrQueue';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

// GET /api/ocr/jobs?status=FAILED,PENDING&page=1&limit=20
router.get('/jobs', async (req: AuthRequest, res: Response): Promise<void> => {
  const statusRaw = String(req.query.status || 'FAILED,PENDING').trim();
  const requestedStatuses = statusRaw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const allowedStatuses = new Set(['PENDING', 'PROCESSING', 'FAILED', 'DONE']);
  const statuses = requestedStatuses.filter((s) => allowedStatuses.has(s));

  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const offset = (page - 1) * limit;

  try {
    const params: unknown[] = [];
    let idx = 1;

    let where = '';
    if (statuses.length > 0) {
      where = `WHERE j.status = ANY($${idx})`;
      params.push(statuses);
      idx += 1;
    }

    const countResult = await query(`SELECT COUNT(*)::int as total FROM ocr_jobs j ${where}`, params);

    const jobsResult = await query(
      `SELECT j.id,
              j.piece_jointe_id,
              j.status,
              j.attempts,
              j.run_after,
              j.last_error,
              j.locked_at,
              j.created_at,
              j.updated_at,
              j.started_at,
              j.finished_at,
              j.processing_ms,
              pj.file_name,
              pj.mime_type,
              pj.courrier_id,
              c.reference as courrier_reference
       FROM ocr_jobs j
       JOIN pieces_jointes pj ON pj.id = j.piece_jointe_id
       LEFT JOIN courriers c ON c.id = pj.courrier_id
       ${where}
       ORDER BY
         CASE WHEN j.status = 'FAILED' THEN 0 WHEN j.status = 'PENDING' THEN 1 WHEN j.status = 'PROCESSING' THEN 2 ELSE 3 END,
         j.updated_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: jobsResult.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error('Erreur GET /ocr/jobs:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur OCR' });
  }
});

// GET /api/ocr/metrics
router.get('/metrics', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const summaryResult = await query(
      `SELECT
         COUNT(*)::int as total_jobs,
         COUNT(*) FILTER (WHERE status = 'PENDING')::int as pending_jobs,
         COUNT(*) FILTER (WHERE status = 'PROCESSING')::int as processing_jobs,
         COUNT(*) FILTER (WHERE status = 'FAILED')::int as failed_jobs,
         COUNT(*) FILTER (WHERE status = 'DONE')::int as done_jobs,
         ROUND(AVG(processing_ms) FILTER (WHERE status = 'DONE' AND processing_ms IS NOT NULL))::int as avg_processing_ms
       FROM ocr_jobs`
    );

    const summary = summaryResult.rows[0] || {
      total_jobs: 0,
      pending_jobs: 0,
      processing_jobs: 0,
      failed_jobs: 0,
      done_jobs: 0,
      avg_processing_ms: 0,
    };

    const totalJobs = Number(summary.total_jobs || 0);
    const failedJobs = Number(summary.failed_jobs || 0);
    const failureRate = totalJobs > 0 ? Number(((failedJobs / totalJobs) * 100).toFixed(2)) : 0;

    const topErrorsResult = await query(
      `SELECT COALESCE(NULLIF(last_error, ''), 'Erreur inconnue') as error,
              COUNT(*)::int as count
       FROM ocr_jobs
       WHERE status = 'FAILED'
       GROUP BY 1
       ORDER BY count DESC
       LIMIT 5`
    );

    res.json({
      success: true,
      metrics: {
        totalJobs,
        pendingJobs: Number(summary.pending_jobs || 0),
        processingJobs: Number(summary.processing_jobs || 0),
        failedJobs,
        doneJobs: Number(summary.done_jobs || 0),
        avgProcessingMs: Number(summary.avg_processing_ms || 0),
        failureRate,
      },
      topErrors: topErrorsResult.rows,
    });
  } catch (error) {
    console.error('Erreur GET /ocr/metrics:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur OCR' });
  }
});

// POST /api/ocr/jobs/:id/retry
router.post('/jobs/:id/retry', async (req: AuthRequest, res: Response): Promise<void> => {
  const jobId = parseInt(req.params.id, 10);
  if (!Number.isFinite(jobId) || jobId <= 0) {
    res.status(400).json({ success: false, message: 'Identifiant job invalide' });
    return;
  }

  try {
    const job = await retryOcrJobById(jobId);
    if (!job) {
      res.status(404).json({ success: false, message: 'Job OCR introuvable' });
      return;
    }

    res.json({ success: true, message: 'Job OCR relancé', job });
  } catch (error) {
    console.error('Erreur POST /ocr/jobs/:id/retry:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur OCR' });
  }
});

// POST /api/ocr/jobs/retry-failed
router.post('/jobs/retry-failed', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await retryAllFailedOcrJobs();
    res.json({ success: true, message: `${count} job(s) OCR relancé(s).`, retriedCount: count });
  } catch (error) {
    console.error('Erreur POST /ocr/jobs/retry-failed:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur OCR' });
  }
});

export default router;
