#!/usr/bin/env bash
# Exécuté à chaque démarrage du Codespace — idempotent (migrations déjà
# appliquées et upserts de seed ne font rien si déjà en place).
set -euo pipefail
cd /workspace

echo "Attente de PostgreSQL..."
for _ in $(seq 1 30); do
  if bash -c "echo > /dev/tcp/postgres/5432" 2>/dev/null; then
    break
  fi
  sleep 1
done

pnpm --filter @navi/backend prisma:generate
pnpm --filter @navi/backend prisma:deploy
SEED_DEV_ADMIN=true pnpm --filter @navi/backend prisma:seed

cat <<'EOF'

────────────────────────────────────────────────────────────
NAVI est prêt.

1. Lancer l'application :
     pnpm dev

2. Onglet "PORTS" (en bas de VS Code) → port 5173 → globe 🌐
   pour ouvrir le frontend dans le navigateur.

3. Se connecter avec le compte de développement local :
     E-mail       : admin@navi.local
     Mot de passe : navi-codespaces-dev

   (Ce compte n'existe que dans CE Codespace — jamais dans un
   environnement partagé ou de production.)
────────────────────────────────────────────────────────────
EOF
