import path from 'path';
import { getClient, query } from '../db';
import { extractAndPersistPieceJointeText } from './documentText';

const OCR_POLL_INTERVAL_MS = parseInt(process.env.OCR_POLL_INTERVAL_MS || '3000', 10);
const OCR_MAX_ATTEMPTS = parseInt(process.env.OCR_MAX_ATTEMPTS || '3', 10);
const OCR_RETRY_DELAY_MS = parseInt(process.env.OCR_RETRY_DELAY_MS || '30000', 10);

let workerStarted = false;
let workerHandle: NodeJS.Timeout | null = null;
let processing = false;

const getUploadDir = () => path.resolve(process.env.UPLOAD_DIR || './uploads');

export const enqueueOcrJob = async (pieceJointeId: number) => {
  await query(
    `INSERT INTO ocr_jobs (piece_jointe_id, status, attempts, run_after, last_error)
     VALUES ($1, 'PENDING', 0, CURRENT_TIMESTAMP, NULL)
     ON CONFLICT (piece_jointe_id)
     DO UPDATE SET
       status = 'PENDING',
       attempts = 0,
       run_after = CURRENT_TIMESTAMP,
       locked_at = NULL,
       started_at = NULL,
       finished_at = NULL,
       processing_ms = NULL,
       last_error = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [pieceJointeId]
  );
};

export const retryOcrJobById = async (jobId: number) => {
  const result = await query(
    `UPDATE ocr_jobs
     SET status = 'PENDING',
         attempts = 0,
         run_after = CURRENT_TIMESTAMP,
         last_error = NULL,
         locked_at = NULL,
         started_at = NULL,
         finished_at = NULL,
         processing_ms = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [jobId]
  );

  return result.rows[0] || null;
};

export const retryAllFailedOcrJobs = async () => {
  const result = await query(
    `UPDATE ocr_jobs
     SET status = 'PENDING',
         attempts = 0,
         run_after = CURRENT_TIMESTAMP,
         last_error = NULL,
         locked_at = NULL,
         started_at = NULL,
         finished_at = NULL,
         processing_ms = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE status = 'FAILED'`
  );

  return result.rowCount || 0;
};

const claimNextJob = async (): Promise<
  | {
      jobId: number;
      pieceJointeId: number;
      filePath: string;
      mimeType: string;
      nextAttempt: number;
    }
  | null
> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT j.id,
              j.piece_jointe_id,
              j.attempts,
              pj.file_path,
              pj.mime_type
       FROM ocr_jobs j
       JOIN pieces_jointes pj ON pj.id = j.piece_jointe_id
       WHERE j.status IN ('PENDING', 'FAILED')
         AND j.run_after <= CURRENT_TIMESTAMP
         AND j.attempts < $1
       ORDER BY j.created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [OCR_MAX_ATTEMPTS]
    );

    if (result.rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }

    const row = result.rows[0] as {
      id: number;
      piece_jointe_id: number;
      attempts: number;
      file_path: string;
      mime_type: string;
    };

    const nextAttempt = row.attempts + 1;

    await client.query(
      `UPDATE ocr_jobs
       SET status = 'PROCESSING',
           attempts = attempts + 1,
           locked_at = CURRENT_TIMESTAMP,
           started_at = CURRENT_TIMESTAMP,
           finished_at = NULL,
           processing_ms = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [row.id]
    );

    await client.query('COMMIT');

    return {
      jobId: row.id,
      pieceJointeId: row.piece_jointe_id,
      filePath: path.resolve(getUploadDir(), row.file_path),
      mimeType: row.mime_type,
      nextAttempt,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const markJobDone = async (jobId: number) => {
  await query(
    `UPDATE ocr_jobs
     SET status = 'DONE',
         last_error = NULL,
         locked_at = NULL,
      finished_at = CURRENT_TIMESTAMP,
      processing_ms = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(started_at, created_at))) * 1000))::int,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [jobId]
  );
};

const markJobFailed = async (jobId: number, attempt: number, errorMessage: string) => {
  const delayMs = OCR_RETRY_DELAY_MS * Math.max(1, attempt);
  const seconds = Math.ceil(delayMs / 1000);

  await query(
    `UPDATE ocr_jobs
     SET status = 'FAILED',
         last_error = $2,
         locked_at = NULL,
       finished_at = CURRENT_TIMESTAMP,
       processing_ms = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(started_at, created_at))) * 1000))::int,
         run_after = CURRENT_TIMESTAMP + make_interval(secs => $3::int),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [jobId, errorMessage.slice(0, 1000), seconds]
  );
};

const processNextJob = async () => {
  if (processing) return;

  processing = true;
  try {
    const job = await claimNextJob();
    if (!job) {
      processing = false;
      return;
    }

    try {
      await extractAndPersistPieceJointeText(job.pieceJointeId, job.filePath, job.mimeType);
      await markJobDone(job.jobId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur OCR inconnue';
      await markJobFailed(job.jobId, job.nextAttempt, message);
    }
  } catch (error) {
    console.error('Erreur worker OCR:', error);
  } finally {
    processing = false;
  }
};

export const startOcrWorker = () => {
  if (workerStarted) return;
  workerStarted = true;

  workerHandle = setInterval(() => {
    void processNextJob();
  }, OCR_POLL_INTERVAL_MS);

  // Lancer un traitement immédiatement au démarrage.
  void processNextJob();
  console.info(`✅ Worker OCR démarré (interval=${OCR_POLL_INTERVAL_MS}ms, maxAttempts=${OCR_MAX_ATTEMPTS}).`);
};

export const stopOcrWorker = () => {
  if (!workerHandle) return;
  clearInterval(workerHandle);
  workerHandle = null;
  workerStarted = false;
};
