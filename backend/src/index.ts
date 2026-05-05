import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fileUpload from 'express-fileupload';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { query } from './db';

import { runMigrations } from './db/migrate';
import authRoutes from './routes/auth';
import courriersRoutes from './routes/courriers';
import directionsRoutes from './routes/directions';
import notificationsRoutes from './routes/notifications';
import ocrRoutes from './routes/ocr';
import usersRoutes from './routes/users';
import { startOcrWorker } from './services/ocrQueue';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const disableGlobalRateLimit = process.env.DISABLE_GLOBAL_RATE_LIMIT === 'true' || !isProduction;
const disableAuthRateLimit = process.env.DISABLE_AUTH_RATE_LIMIT === 'true' || !isProduction;

// ─── Sécurité ────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiter global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: 'Trop de requêtes, réessayez plus tard.' },
  skip: () => disableGlobalRateLimit,
});
app.use(limiter);

// Rate limiter plus strict pour l'auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Trop de tentatives de connexion.' },
  skip: () => disableAuthRateLimit,
});

// ─── Middleware ───────────────────────────────────────────────
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(fileUpload({
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') },
  useTempFiles: false,
}));

// ─── Fichiers statiques (uploads) ────────────────────────────
const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(uploadDir)));

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/courriers', courriersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/directions', directionsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/ocr', ocrRoutes);

// ─── Healthcheck ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'GED FPS API opérationnelle', timestamp: new Date() });
});

// ─── 404 ─────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route introuvable' });
});

// ─── Erreur globale ──────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Erreur non gérée:', err);
  res.status(500).json({ success: false, message: 'Erreur serveur interne' });
});

// ─── Démarrage ───────────────────────────────────────────────
const ensureCourriersAnnexesColumn = async () => {
  try {
    await query(
      `ALTER TABLE courriers
       ADD COLUMN IF NOT EXISTS nombre_annexes INTEGER DEFAULT 0`
    );
  } catch (error) {
    console.error('⚠️ [INTÉGRITÉ] Impossible de garantir la colonne courriers.nombre_annexes:', error);
  }
};

const ensureUsersMustChangePasswordColumn = async () => {
  try {
    await query(
      `ALTER TABLE users
       ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE`
    );
  } catch (error) {
    console.error('⚠️ [INTÉGRITÉ] Impossible de garantir la colonne users.must_change_password:', error);
  }
};

const ensurePasswordResetTokensTable = async () => {
  try {
    await query(
      `CREATE TABLE IF NOT EXISTS password_reset_tokens (
         id SERIAL PRIMARY KEY,
         user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         token_hash TEXT NOT NULL UNIQUE,
         expires_at TIMESTAMP NOT NULL,
         used_at TIMESTAMP,
         requested_ip VARCHAR(45),
         user_agent TEXT,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )`
    );

    await query(
      'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)'
    );
    await query(
      'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at)'
    );
  } catch (error) {
    console.error('⚠️ [INTÉGRITÉ] Impossible de garantir la table password_reset_tokens:', error);
  }
};

const ensurePiecesJointesOcrColumns = async () => {
  try {
    await query(
      `ALTER TABLE pieces_jointes
       ADD COLUMN IF NOT EXISTS extracted_text TEXT`
    );
    await query(
      `ALTER TABLE pieces_jointes
       ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMP`
    );
    await query(
      `ALTER TABLE pieces_jointes
       ADD COLUMN IF NOT EXISTS ocr_status VARCHAR(30) DEFAULT 'PENDING'`
    );
    await query(
      `ALTER TABLE pieces_jointes
       ADD COLUMN IF NOT EXISTS ocr_error TEXT`
    );

    await query(
      `CREATE INDEX IF NOT EXISTS idx_pieces_jointes_ocr_status
       ON pieces_jointes(ocr_status)`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_pieces_jointes_extracted_text_fts
       ON pieces_jointes USING GIN (to_tsvector('simple', COALESCE(extracted_text, '')))`
    );
  } catch (error) {
    console.error('⚠️ [INTÉGRITÉ] Impossible de garantir les colonnes OCR de pieces_jointes:', error);
  }
};

const ensureOcrJobsTable = async () => {
  try {
    await query(
      `CREATE TABLE IF NOT EXISTS ocr_jobs (
         id SERIAL PRIMARY KEY,
         piece_jointe_id INTEGER NOT NULL UNIQUE REFERENCES pieces_jointes(id) ON DELETE CASCADE,
         status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
         attempts INTEGER NOT NULL DEFAULT 0,
         run_after TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         last_error TEXT,
         locked_at TIMESTAMP,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )`
    );

     await query(
      `ALTER TABLE ocr_jobs
       ADD COLUMN IF NOT EXISTS started_at TIMESTAMP`
     );
     await query(
      `ALTER TABLE ocr_jobs
       ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP`
     );
     await query(
      `ALTER TABLE ocr_jobs
       ADD COLUMN IF NOT EXISTS processing_ms INTEGER`
     );

    await query(
      `CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status_run_after
       ON ocr_jobs(status, run_after)`
    );
  } catch (error) {
    console.error('⚠️ [INTÉGRITÉ] Impossible de garantir la table ocr_jobs:', error);
  }
};

const checkDirectionDGIntegrity = async () => {
  try {
    const result = await query(
      `SELECT id, name, code
       FROM directions
       WHERE is_active = TRUE
         AND UPPER(COALESCE(code, '')) = 'DG'
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      console.error('⚠️ [INTÉGRITÉ] Direction DG absente : créez une direction active avec code DG pour le rattachement des profils assistants.');
      return;
    }

    const direction = result.rows[0];
    console.info(`✅ [INTÉGRITÉ] Direction DG détectée: ${direction.name} (id=${direction.id}).`);
  } catch (error) {
    console.error('⚠️ [INTÉGRITÉ] Vérification Direction DG impossible au démarrage:', error);
  }
};

app.listen(PORT, () => {
  console.info(`✅ Serveur GED FPS démarré sur http://localhost:${PORT}`);
  console.info(`📋 Environnement : ${process.env.NODE_ENV || 'development'}`);
  void (async () => {
    await runMigrations();
    await ensureCourriersAnnexesColumn();
    await ensureUsersMustChangePasswordColumn();
    await ensurePasswordResetTokensTable();
    await ensurePiecesJointesOcrColumns();
    await ensureOcrJobsTable();
    await checkDirectionDGIntegrity();
    startOcrWorker();
  })();
});

export default app;
