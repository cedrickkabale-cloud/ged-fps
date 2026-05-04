#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

stop_matching_processes() {
  local pattern="$1"
  local pids

  pids="$(pgrep -f "${pattern}" 2>/dev/null || true)"
  if [[ -z "${pids}" ]]; then
    return
  fi

  echo "[INFO] Arret des processus detectes (${pattern}) : ${pids//$'\n'/, }"
  # Tentative d'arret propre d'abord
  echo "${pids}" | xargs kill -15 2>/dev/null || true
  # Force l'arret si certains PIDs resistent
  echo "${pids}" | xargs kill -9 2>/dev/null || true
}

free_port() {
  local port="$1"

  if ! command -v lsof >/dev/null 2>&1; then
    echo "[WARN] lsof introuvable, impossible de liberer le port ${port} automatiquement."
    return
  fi

  local pids
  pids="$(lsof -ti :"${port}" 2>/dev/null || true)"

  if [[ -n "${pids}" ]]; then
    echo "[INFO] Liberation du port ${port} (PID: ${pids//$'\n'/, })"
    # kill -9 pour eviter les process fantomes qui gardent les ports occupes
    echo "${pids}" | xargs kill -9
  fi
}

echo "[INFO] Verrouillage des ports de dev (3000, 5000)"
# Evite les watchers orphelins qui ne tiennent pas forcement les ports au moment du check.
stop_matching_processes "${ROOT_DIR}/backend.*nodemon --exec ts-node src/index.ts"
stop_matching_processes "${ROOT_DIR}/backend.*ts-node src/index.ts"
stop_matching_processes "${ROOT_DIR}/frontend.*next dev"

free_port 3000
free_port 5000

NEXT_CACHE_DIR="${ROOT_DIR}/frontend/.next"
if [[ -d "${NEXT_CACHE_DIR}" ]]; then
  echo "[INFO] Nettoyage du cache frontend (.next)"
  rm -rf "${NEXT_CACHE_DIR}"
fi

echo "[INFO] Demarrage GED FPS (frontend + backend)"
cd "${ROOT_DIR}"
exec npx concurrently "npm run dev --prefix backend" "npm run dev --prefix frontend"
