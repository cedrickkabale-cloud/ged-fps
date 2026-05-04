# GED FPS — Gestion Électronique des Documents

Application web complète de gestion des courriers entrants et sortants pour le **Fonds de Promotion de la Santé (FPS)**.

---

## Stack technique

| Couche           | Technologie                            |
| ---------------- | -------------------------------------- |
| Frontend         | Next.js 14 + TypeScript + Tailwind CSS |
| Backend          | Node.js + Express + TypeScript         |
| Base de données  | PostgreSQL                             |
| Authentification | JWT                                    |

---

## Structure du projet

```
GED FPS/
├── frontend/          → Application Next.js
├── backend/           → API REST Node.js/Express
└── database/
    └── schema.sql     → Schéma complet PostgreSQL
```

---

## Installation

### Prérequis

- Node.js >= 18
- PostgreSQL >= 14
- npm ou yarn

### 1. Base de données

```bash
# Créer la base de données
psql -U postgres -c "CREATE DATABASE ged_fps;"

# Exécuter le schéma
psql -U postgres -d ged_fps -f database/schema.sql
```

### 2. Backend

```bash
cd backend
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos informations PostgreSQL

# Démarrer en développement (backend seul)
npm run dev
```

Le serveur démarre sur **http://localhost:5000**

### 3. Frontend

```bash
cd frontend
npm install

# Démarrer en développement (frontend seul)
npm run dev
```

L'application démarre sur **http://localhost:3000**

### 4. Démarrage recommandé (frontend + backend)

Depuis la racine du projet :

```bash
npm install
npm run dev
```

Le script racine nettoie les ports 3000/5000 et stoppe les watchers orphelins avant de relancer les deux services.

### 5. Mot de passe oublié par email

Dans [backend/.env.example](backend/.env.example), renseignez ces variables dans votre fichier backend .env :

```bash
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@votre-domaine.com
SMTP_PASS=votre_mot_de_passe_email_hostinger
MAIL_FROM="GED FPS <no-reply@votre-domaine.com>"
APP_URL=http://localhost:3000
```

Le flux fonctionne ainsi :

- l'utilisateur clique sur Mot de passe oublié depuis la page de connexion
- il saisit son adresse email
- un lien de réinitialisation valable 30 minutes est envoyé
- il définit un nouveau mot de passe depuis ce lien

Remarques d'exploitation :

- le reset manuel par administrateur reste disponible comme solution de secours
- si la configuration SMTP est absente ou invalide, l'envoi de l'email échouera
- sur une base déjà existante, la table password_reset_tokens est créée automatiquement au démarrage du backend

---

## Compte administrateur initial

Après avoir appliqué le schéma SQL, créez un administrateur via l'API :
```bash
curl -X POST http://localhost:5000/api/auth/register-admin \
  -H "Content-Type: application/json" \
  -d '{"fullname":"Administrateur","email":"admin@fps.cd","password":"Admin@2026"}'
```

Ou directement en SQL :

```sql
INSERT INTO users (fullname, email, password, role_id)
VALUES (
  'Administrateur',
  'admin@fps.cd',
  -- Hash bcrypt de 'Admin@2026'
  '$2b$12$...',
  (SELECT id FROM roles WHERE name = 'ADMIN')
);
```

---

## Workflow du courrier

```
RECU → ENTREE_DG → SORTIE_DG → ENTREE_DGA → SORTIE_DGA
     → ORIENTE → RECU_DIRECTION → EN_TRAITEMENT
  → RETOUR → ENTREE_DG_RETOUR → SORTIE_DG_RETOUR
  → ENTREE_DGA_RETOUR → SORTIE_DGA_RETOUR
     → SORTANT_ENREGISTRE → SORTANT_ENVOYE → CLASSE
```

## Rôles disponibles

| Rôle                                    | Accès                   |
| --------------------------------------- | ----------------------- |
| ADMIN                                   | Total                   |
| DG / DGA                                | Global                  |
| SECRETAIRE_ADMIN / SECRETAIRE_ADMIN_ADJ | Global                  |
| SECRETAIRE_DG / SECRETAIRE_DGA          | Global + actions bureau |
| DIRECTEUR / SECRETAIRE_DIRECTION        | Direction uniquement    |
| ASSISTANT_TECHNIQUE / ASSISTANT_JURIDIQUE / ASSISTANT_FINANCIER | Suivi direction métier (DT/DJ/DF) |
| PROTOCOLE                               | Orientation + suivi protocolaire |
| COURRIER_ENTRANT                        | Saisie courriers        |
| COURRIER_SORTANT                        | Sortants + confirmation |

---

## API principales

| Méthode | Route                         | Description                |
| ------- | ----------------------------- | -------------------------- |
| POST    | `/api/auth/login`             | Connexion                  |
| GET     | `/api/auth/me`                | Profil connecté            |
| GET     | `/api/courriers`              | Liste des courriers        |
| POST    | `/api/courriers`              | Créer un courrier          |
| GET     | `/api/courriers/:id`          | Détail + tracking          |
| POST    | `/api/courriers/:id/workflow` | Avancer dans le workflow   |
| GET     | `/api/courriers/stats`        | Statistiques dashboard     |
| GET     | `/api/users`                  | Liste utilisateurs (Admin) |
| POST    | `/api/users`                  | Créer utilisateur (Admin)  |
| GET     | `/api/directions`             | Liste directions           |
| GET     | `/api/notifications`          | Notifications utilisateur  |

---

## Convention ESLint d'equipe

Pour verrouiller une qualite de code durable, le projet applique ces 3 regles communes (frontend + backend):

- `no-console`: interdit `console.log`, autorise seulement `console.warn` et `console.error`
- `eqeqeq`: impose `===` / `!==` (pas de `==` / `!=`)
- `no-duplicate-imports`: interdit les imports dupliques dans un meme fichier

Validation recommandee avant merge:

```bash
npm run lint:strict
```

---

## Déploiement Hostinger KVM1 — Guide complet (~58 USD/an)

### Budget détaillé

| Poste | Détail | USD |
|-------|--------|-----|
| VPS KVM1 × 12 mois | 1 vCPU, 4 GB RAM, 50 GB SSD | ~$47.88 |
| Nom de domaine .com | 1ère année | ~$10 |
| SMTP Brevo | 300 emails/jour | **$0** |
| **Total annuel** | | **~$58 USD** |

> Renouvellement à partir de la 2ème année : ~$57.88/an (domaine ~$10-15/an selon registrar).

---

### Étape 1 — Acheter le VPS KVM1

1. Aller sur **https://www.hostinger.com/vps-hosting**
2. Choisir **KVM 1** (plan le moins cher)
3. Durée : **12 mois** (prix réduit)
4. Système d'exploitation : **Ubuntu 22.04 LTS** (obligatoire)
5. Région : choisir **Europe (Amsterdam ou Paris)** pour la RDC — latence correcte
6. Payer par carte Visa/Mastercard ou PayPal

### Étape 2 — Acheter le nom de domaine

1. Sur Hostinger : **https://www.hostinger.com/domain-name-search**
2. Rechercher `fps-ged.com` ou `ged-fps.com` (ou autre nom disponible)
3. Ajouter au panier avec le VPS (souvent offert la 1ère année avec le VPS)

### Étape 3 — Configurer Brevo SMTP (gratuit)

1. Créer un compte sur **https://app.brevo.com** (gratuit, 300 emails/jour)
2. Aller dans **Settings → SMTP & API → SMTP**
3. Cliquer **Generate a new SMTP key**
4. Noter : **Login** (= `SMTP_USER`) et **Password** généré (= `SMTP_PASS`)

### Étape 4 — Se connecter au VPS

Après l'achat, Hostinger envoie par email : IP du serveur + mot de passe root.

```bash
ssh root@VOTRE_IP_VPS
```

### Étape 5 — Préparer le serveur

```bash
# Mise à jour
apt update && apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Git + outils OCR
apt install -y git poppler-utils tesseract-ocr tesseract-ocr-fra

# PM2
npm install -g pm2

# PostgreSQL
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# Nginx
apt install -y nginx certbot python3-certbot-nginx
```

### Étape 6 — Créer la base de données PostgreSQL

```bash
sudo -u postgres psql
```

Dans psql :

```sql
CREATE USER ged_user WITH PASSWORD 'un_mot_de_passe_fort';
CREATE DATABASE ged_fps OWNER ged_user;
GRANT ALL PRIVILEGES ON DATABASE ged_fps TO ged_user;
\q
```

### Étape 7 — Copier le projet sur le serveur

Depuis **votre Mac** (terminal local) :

```bash
cd "/Users/kabalecedrick/Desktop/Projet Web 2/GED FPS"
scp -r . root@VOTRE_IP_VPS:/var/www/ged-fps
```

Ou via Git si le projet est sur GitHub :

```bash
# Sur le serveur
git clone https://github.com/VOTRE_REPO/ged-fps.git /var/www/ged-fps
```

### Étape 8 — Configurer les variables d'environnement

```bash
cd /var/www/ged-fps

# Backend
cp backend/.env.production.example backend/.env
nano backend/.env
```

Remplir ces valeurs clés :

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ged_fps
DB_USER=ged_user
DB_PASSWORD=un_mot_de_passe_fort

JWT_SECRET=changer_avec_une_valeur_aleatoire_longue_64_chars

FRONTEND_URL=https://votre-domaine.com
APP_URL=https://votre-domaine.com

SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre_cle_smtp_brevo
MAIL_FROM="GED FPS <no-reply@votre-domaine.com>"
```

```bash
# Frontend
cp frontend/.env.production.example frontend/.env.production
nano frontend/.env.production
```

```env
NEXT_PUBLIC_BACKEND_INTERNAL_URL=http://127.0.0.1:5000
```

### Étape 9 — Initialiser la base de données

```bash
sudo -u postgres psql -d ged_fps -f /var/www/ged-fps/database/schema.sql
```

### Étape 10 — Déployer l'application

```bash
cd /var/www/ged-fps
npm run deploy:hostinger
```

Cette commande installe toutes les dépendances, build backend + frontend, et démarre PM2.

Vérifier :

```bash
pm2 status
curl -s http://127.0.0.1:5000/api/health
```

### Étape 11 — Configurer Nginx

```bash
nano /etc/nginx/sites-available/ged-fps
```

Coller :

```nginx
server {
    server_name votre-domaine.com www.votre-domaine.com;

    # Taille max upload (fichiers courriers)
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activer :

```bash
ln -s /etc/nginx/sites-available/ged-fps /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### Étape 12 — Pointer le domaine vers le VPS

Dans Hostinger → **Domains → DNS Zone** de votre domaine :

| Type | Nom | Valeur |
|------|-----|--------|
| A | @ | VOTRE_IP_VPS |
| A | www | VOTRE_IP_VPS |

Attendre 5-30 minutes la propagation DNS.

### Étape 13 — Activer HTTPS (Let's Encrypt — gratuit)

```bash
certbot --nginx -d votre-domaine.com -d www.votre-domaine.com
```

Suivre les instructions. Certbot configure automatiquement Nginx.

### Étape 14 — Créer le premier compte admin

```bash
cd /var/www/ged-fps
node backend/create-admin.js
```

### Étape 15 — Démarrage automatique au reboot

```bash
pm2 startup
# Copier-coller la commande affichée par PM2
pm2 save
```

### Résumé des URLs finales

| Service | URL |
|---------|-----|
| Application | https://votre-domaine.com |
| Backend API | https://votre-domaine.com/api |
| Login admin | https://votre-domaine.com/login |

---

## Déploiement Hostinger (pas-à-pas — ancienne section simplifiée)

Objectif : copier le projet sur Hostinger, coller les fichiers de config, puis lancer une seule commande.

### 1. Fichiers déjà prêts dans le projet

- Script de déploiement : [scripts/hostinger-deploy.sh](scripts/hostinger-deploy.sh)
- PM2 process manager : [ecosystem.config.cjs](ecosystem.config.cjs)
- Variables backend prod : [backend/.env.production.example](backend/.env.production.example)
- Variables frontend prod : [frontend/.env.production.example](frontend/.env.production.example)

### 2. Préparer les variables de production

Sur le serveur, copier puis compléter :

```bash
cp backend/.env.production.example backend/.env
cp frontend/.env.production.example frontend/.env.production
```

Vérifier surtout :

- `JWT_SECRET`
- `DB_*`
- `FRONTEND_URL`
- `APP_URL`
- `SMTP_*`

### 3. Prérequis système VPS Hostinger

Installer les dépendances OCR PDF scanné :

```bash
sudo apt update
sudo apt install -y poppler-utils tesseract-ocr tesseract-ocr-fra
```

### 4. Lancer le déploiement en une commande

Depuis la racine du projet :

```bash
npm run deploy:hostinger
```

Cette commande fait :

1. install dépendances racine/backend/frontend
2. build backend/frontend
3. installation PM2 si manquant
4. démarrage/reload des services via PM2

### 5. Vérifier que tout tourne

```bash
pm2 status
curl -sS http://127.0.0.1:5000/api/health
```

### 6. Reverse proxy (Nginx)

Pointer le domaine vers Next.js : `http://127.0.0.1:3000`.
Les routes `/api/*` et `/uploads/*` sont proxifiées par Next.js vers le backend via [frontend/next.config.js](frontend/next.config.js).

Exemple minimal Nginx :

```nginx
server {
  server_name votre-domaine.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

### 7. SSL

Activer HTTPS (Let's Encrypt) après vérification du domaine :

```bash
sudo certbot --nginx -d votre-domaine.com
```
