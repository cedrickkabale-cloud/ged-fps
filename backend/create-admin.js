/**
 * Script de création de l'utilisateur administrateur initial
 * Usage : node create-admin.js
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const readline = require('readline');
require('dotenv').config();

// ─── Configuration ────────────────────────────────────────────
// Modifiez ces valeurs ou définissez les variables d'environnement
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ged_fps',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
};

// ─── Utilitaires ──────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (question) =>
  new Promise((resolve) => rl.question(question, resolve));

const askHidden = (question) =>
  new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.openStdin();
    process.stdin.setRawMode(true);
    let password = '';
    process.stdin.on('data', (ch) => {
      ch = ch.toString('utf8');
      if (ch === '\n' || ch === '\r' || ch === '\u0004') {
        process.stdin.setRawMode(false);
        process.stdout.write('\n');
        stdin.pause();
        resolve(password);
      } else if (ch === '\u0003') {
        process.exit();
      } else if (ch === '\u007F') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        password += ch;
        process.stdout.write('*');
      }
    });
  });

// ─── Script principal ─────────────────────────────────────────
async function main() {
  console.log('\n========================================');
  console.log('  GED FPS — Création Administrateur');
  console.log('========================================\n');

  const pool = new Pool(DB_CONFIG);

  try {
    // Vérifier connexion
    await pool.query('SELECT 1');
    console.log('✅ Connexion à PostgreSQL réussie\n');
  } catch (err) {
    console.error('❌ Impossible de se connecter à PostgreSQL :', err.message);
    console.error('   Vérifiez DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
    process.exit(1);
  }

  // Vérifier que le rôle ADMIN existe
  const roleResult = await pool.query("SELECT id FROM roles WHERE name = 'ADMIN'");
  if (roleResult.rows.length === 0) {
    console.error('❌ Rôle ADMIN introuvable. Avez-vous exécuté database/schema.sql ?');
    process.exit(1);
  }
  const adminRoleId = roleResult.rows[0].id;

  // Vérifier s'il existe déjà un admin
  const existingAdmin = await pool.query(
    "SELECT u.email FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'ADMIN'"
  );
  if (existingAdmin.rows.length > 0) {
    console.log(`⚠️  Un administrateur existe déjà : ${existingAdmin.rows[0].email}`);
    const continuer = await ask('Créer un administrateur supplémentaire ? (o/N) : ');
    if (continuer.toLowerCase() !== 'o') {
      console.log('Annulé.');
      rl.close();
      await pool.end();
      process.exit(0);
    }
  }

  // Saisie des informations
  const fullname = await ask('Nom complet        : ');
  const email    = await ask('Adresse email      : ');
  const password = await ask('Mot de passe (min 6 caractères) : ');

  // Validations
  if (!fullname.trim()) {
    console.error('❌ Nom complet requis');
    process.exit(1);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    console.error('❌ Adresse email invalide');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('❌ Le mot de passe doit contenir au moins 6 caractères');
    process.exit(1);
  }

  // Vérifier unicité email
  const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim()]);
  if (emailCheck.rows.length > 0) {
    console.error(`❌ L'email ${email.trim()} est déjà utilisé`);
    process.exit(1);
  }

  // Hachage du mot de passe
  console.log('\n⏳ Création du compte administrateur...');
  const hashedPassword = await bcrypt.hash(password, 12);

  // Insertion
  const result = await pool.query(
    `INSERT INTO users (fullname, email, password, role_id, is_active)
     VALUES ($1, $2, $3, $4, TRUE)
     RETURNING id, fullname, email, created_at`,
    [fullname.trim(), email.trim(), hashedPassword, adminRoleId]
  );

  const admin = result.rows[0];

  // Audit log
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, table_name, record_id)
     VALUES ($1, 'CREATE_ADMIN_INITIAL', 'users', $2)`,
    [admin.id, admin.id]
  );

  console.log('\n✅ Administrateur créé avec succès !');
  console.log('─────────────────────────────────────');
  console.log(`   ID       : ${admin.id}`);
  console.log(`   Nom      : ${admin.fullname}`);
  console.log(`   Email    : ${admin.email}`);
  console.log(`   Créé le  : ${new Date(admin.created_at).toLocaleString('fr-FR')}`);
  console.log('─────────────────────────────────────');
  console.log('\n🚀 Vous pouvez maintenant vous connecter sur http://localhost:3000/login\n');

  rl.close();
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Erreur inattendue :', err.message);
  process.exit(1);
});
