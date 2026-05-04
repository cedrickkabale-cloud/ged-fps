#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}"

echo "[1/6] Installation dépendances racine"
npm install

echo "[2/6] Installation dépendances backend"
npm install --prefix backend

echo "[3/6] Installation dépendances frontend"
npm install --prefix frontend

echo "[4/6] Build backend"
npm run build --prefix backend

echo "[5/6] Build frontend"
npm run build --prefix frontend

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[6/6] PM2 non trouvé, installation globale"
  npm install -g pm2
else
  echo "[6/6] PM2 trouvé"
fi

echo "[START] Démarrage/Reload PM2"
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save

echo "Déploiement terminé."
pm2 status
