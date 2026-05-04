-- ============================================================
-- GED FPS - SCHÉMA COMPLET DE LA BASE DE DONNÉES
-- ============================================================

-- Extension UUID (optionnel)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ENUM DES STATUTS DU WORKFLOW
-- ============================================================
CREATE TYPE statut_courrier AS ENUM (
    'RECU',
    'ENTREE_DGA',
    'SORTIE_DGA',
    'ENTREE_DG',
    'SORTIE_DG',
    'ORIENTE',
    'RECU_DIRECTION',
    'EN_TRAITEMENT',
    'RETOUR',
    'ENTREE_DGA_RETOUR',
    'SORTIE_DGA_RETOUR',
    'ENTREE_DG_RETOUR',
    'SORTIE_DG_RETOUR',
    'SORTANT_ENREGISTRE',
    'SORTANT_ENVOYE',
    'CLASSE'
);

-- ============================================================
-- 2. TABLE DES RÔLES
-- ============================================================
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. TABLE DES DIRECTIONS
-- ============================================================
CREATE TABLE directions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. TABLE DES UTILISATEURS
-- ============================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    fullname VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    direction_id INTEGER REFERENCES directions(id) ON DELETE SET NULL,
    must_change_password BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 5. TABLE DES COURRIERS
-- ============================================================
CREATE TABLE courriers (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(100),
    numero VARCHAR(50),          -- Numéro attribué manuellement au courrier entrant
    nombre_annexes INTEGER DEFAULT 0,
    objet TEXT NOT NULL,
    expediteur VARCHAR(150),
    date_reception TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fichier_joint TEXT,
    statut statut_courrier DEFAULT 'RECU',
    direction_id INTEGER REFERENCES directions(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    priorite VARCHAR(20) DEFAULT 'NORMALE',  -- NORMALE, URGENTE, CONFIDENTIELLE
    type_courrier VARCHAR(50) DEFAULT 'ENTRANT', -- ENTRANT, SORTANT
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. TABLE DE SUIVI / TRACKING DU WORKFLOW
-- ============================================================
CREATE TABLE courriers_tracking (
    id SERIAL PRIMARY KEY,
    courrier_id INTEGER REFERENCES courriers(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    acteur_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    role VARCHAR(100),
    statut_avant statut_courrier,
    statut_apres statut_courrier,
    date_action TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    commentaire TEXT
);

-- ============================================================
-- 7. TABLE DES COURRIERS SORTANTS
-- ============================================================
CREATE TABLE courriers_sortants (
    id SERIAL PRIMARY KEY,
    courrier_id INTEGER REFERENCES courriers(id) ON DELETE CASCADE,
    numero_sortant VARCHAR(100) UNIQUE,
    destinataire VARCHAR(150),
    adresse_destinataire TEXT,
    date_enregistrement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirme BOOLEAN DEFAULT FALSE,
    date_confirmation TIMESTAMP,
    confirme_par INTEGER REFERENCES users(id) ON DELETE SET NULL,
    mode_envoi VARCHAR(50) DEFAULT 'PHYSIQUE', -- PHYSIQUE, EMAIL, FAX
    notes TEXT
);

-- ============================================================
-- 8. TABLE DES PIÈCES JOINTES
-- ============================================================
CREATE TABLE pieces_jointes (
    id SERIAL PRIMARY KEY,
    courrier_id INTEGER REFERENCES courriers(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    extracted_text TEXT,
    extracted_at TIMESTAMP,
    ocr_status VARCHAR(30) DEFAULT 'PENDING',
    ocr_error TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 9. TABLE DES NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    courrier_id INTEGER REFERENCES courriers(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO', -- INFO, WARNING, SUCCESS, ERROR
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10. TABLE AUDIT LOG
-- ============================================================
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    table_name VARCHAR(100),
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 11. TABLE DES JETONS DE RÉINITIALISATION DE MOT DE PASSE
-- ============================================================
CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    requested_ip VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 12. TABLE DE FILE OCR (PIPELINE ASYNCHRONE)
-- ============================================================
CREATE TABLE ocr_jobs (
    id SERIAL PRIMARY KEY,
    piece_jointe_id INTEGER NOT NULL UNIQUE REFERENCES pieces_jointes(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    run_after TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_error TEXT,
    locked_at TIMESTAMP,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    processing_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEX POUR PERFORMANCE
-- ============================================================
CREATE INDEX idx_courriers_statut ON courriers(statut);
CREATE INDEX idx_courriers_direction ON courriers(direction_id);
CREATE INDEX idx_courriers_date ON courriers(date_reception);
CREATE INDEX idx_tracking_courrier ON courriers_tracking(courrier_id);
CREATE INDEX idx_tracking_date ON courriers_tracking(date_action);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_date ON audit_logs(created_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX idx_pieces_jointes_ocr_status ON pieces_jointes(ocr_status);
CREATE INDEX idx_pieces_jointes_extracted_text_fts ON pieces_jointes USING GIN (to_tsvector('simple', COALESCE(extracted_text, '')));
CREATE INDEX idx_ocr_jobs_status_run_after ON ocr_jobs(status, run_after);

-- ============================================================
-- DONNÉES INITIALES
-- ============================================================

-- Rôles
INSERT INTO roles (name, description) VALUES
('ADMIN', 'Administrateur système - accès total'),
('DG', 'Directeur Général - accès global'),
('DGA', 'Directeur Général Adjoint - accès global'),
('PROTOCOLE', 'Protocole - distribution interne et suivi des validations de réception'),
('SECRETAIRE_ADMIN', 'Secrétaire Administratif - accès global'),
('SECRETAIRE_ADMIN_ADJ', 'Secrétaire Administratif Adjoint - accès global'),
('SECRETAIRE_DG', 'Secrétaire du DG - accès global'),
('SECRETAIRE_DGA', 'Secrétaire du DGA - accès global'),
('DIRECTEUR', 'Directeur de direction - accès restreint à sa direction'),
('SECRETAIRE_DIRECTION', 'Secrétaire de direction - accès restreint à sa direction'),
('ASSISTANT_TECHNIQUE', 'Assistant Technique - suivi Direction Technique'),
('ASSISTANT_JURIDIQUE', 'Assistant Juridique - suivi Direction Juridique'),
('ASSISTANT_FINANCIER', 'Assistant Financier - suivi Direction Financière'),
('COURRIER_ENTRANT', 'Chargé des courriers entrants'),
('COURRIER_SORTANT', 'Chargé des courriers sortants');

-- Directions
INSERT INTO directions (name, code, description) VALUES
('Direction des Ressources Humaines', 'DRH', 'Gestion du personnel'),
('Direction Technique', 'DT', 'Gestion technique'),
('Direction Juridique', 'DJ', 'Affaires juridiques'),
('Direction des Systèmes Informatique et Communication', 'DIRSIC', 'Systèmes d''information'),
('Direction Financière', 'DF', 'Gestion financière'),
('Direction de la Gouvernance', 'DG_DIR', 'Gouvernance'),
('Direction de la Communication', 'DC', 'Communication'),
('Secrétariat Administratif', 'SA', 'Secrétariat administratif général'),
('Assistant Financier', 'ASF', 'Assistance et suivi financier'),
('Assistant Juridique', 'ASJ', 'Assistance juridique'),
('Assistant Technique', 'AST', 'Assistance technique'),
('Direction Administrative', 'DA', 'Gestion administrative générale'),
('Direction des Moyens Généraux', 'DMG', 'Gestion des moyens généraux'),
('Direction Informatique', 'DI', 'Gestion informatique et infrastructure'),
('Direction Régionale', 'DR', 'Direction régionale'),
('Cellule de Passation des Marchés Publiques', 'CPMP', 'Passation des marchés publics'),
('Cellule de Communication', 'CC', 'Communication institutionnelle'),
('Cellule d''Audit', 'CA', 'Audit interne');

-- ============================================================
-- TRIGGERS - AUTO UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_courriers_updated_at
    BEFORE UPDATE ON courriers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
