#!/usr/bin/env bash
# Exécuté une seule fois, à la création du Codespace.
set -euo pipefail
cd /workspace

if [ ! -f backend/.env ]; then
  echo "SESSION_SECRET=$(openssl rand -hex 32)" > backend/.env
  echo "→ backend/.env créé (secret de session généré localement, jamais committé)."
fi

# Xvfb + x11vnc + noVNC — navigateur Playwright "headed" visible depuis le
# navigateur (2FA manuelle Expérience, une seule fois). Voir
# .devcontainer/start-vnc.sh et README, section Codespaces.
apt-get update -qq
apt-get install -y --no-install-recommends xvfb x11vnc novnc websockify > /dev/null
echo "→ Xvfb/x11vnc/noVNC installés."

corepack enable
pnpm install
