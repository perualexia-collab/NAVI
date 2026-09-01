#!/usr/bin/env bash
# Exécuté une seule fois, à la création du Codespace.
set -euo pipefail
cd /workspace

if [ ! -f backend/.env ]; then
  echo "SESSION_SECRET=$(openssl rand -hex 32)" > backend/.env
  echo "→ backend/.env créé (secret de session généré localement, jamais committé)."
fi

corepack enable
pnpm install
