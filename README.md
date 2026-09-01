# NAVI — Navigate. Analyze. Act.

Copilote CRM hôtelier posé au-dessus d'Expérience (D-EDGE). Voir [`docs/architecture-proposal.html`](docs/architecture-proposal.html) pour l'architecture validée et le plan de développement (Phase A → I).

## Statut

**Phase C — premier vertical slice réel**, livrée (un seul hôtel, données mockées ailleurs). Prochaine étape : Phase D (scan multi-hôtels).

## Structure

```
frontend/   React + TypeScript + Vite — desktop-first
backend/    Node.js + TypeScript + Fastify
  src/               API, services métier (scoring, signaux)
  experience/        moteur Playwright — extrait progressivement de docs/reference/moteur-experience-existant.js
  scans/             orchestration des scans (backend/scans/run-hotel-scan.ts)
  playbooks/         P01…P12, orchestration métier (Phase E)
  ai/                Ask NAVI, Context Builder, LLM Service (Phase H)
  prisma/            schéma + migrations + seed
shared/     Types TypeScript partagés frontend/backend
docs/reference/   Brief, référentiel métier Excel, moteur Playwright existant — sources de vérité
```

## Lancer NAVI — GitHub Codespaces (recommandé)

Aucune installation locale nécessaire : le devcontainer fournit Node, pnpm,
Playwright, PostgreSQL et Redis, et forwarde automatiquement les ports.

1. Sur GitHub, bouton **Code → Codespaces → Create codespace on `claude/navi-analysis-architecture-s3217c`**
   (ou la branche courante).
2. Attendre la création (quelques minutes la première fois — l'image
   télécharge les dépendances). Un message de bienvenue s'affiche dans le
   terminal une fois prêt, avec les identifiants de connexion.
3. Dans le terminal du Codespace :
   ```bash
   pnpm dev
   ```
4. Onglet **PORTS** (bas de VS Code) → port **5173** → icône globe 🌐 pour
   ouvrir NAVI dans le navigateur.
5. Se connecter avec le compte de développement local (créé automatiquement,
   uniquement dans ce Codespace) :
   - E-mail : `admin@navi.local`
   - Mot de passe : `navi-codespaces-dev`

Ce compte et l'hôtel pilote (`Hôtel Apollinaire`) sont recréés à chaque
démarrage du Codespace si absents (`.devcontainer/post-start.sh`) — rien à
faire manuellement après la première fois.

## Démarrage en local (alternative)

```bash
docker compose up -d postgres redis
cp .env.example backend/.env
sed -i "s#SESSION_SECRET=change-me#SESSION_SECRET=$(openssl rand -hex 32)#" backend/.env
pnpm install
pnpm prisma:deploy
pnpm prisma:seed
pnpm dev            # backend (:4000) + frontend (:5173) en parallèle
```

Sans compte créé (l'inscription publique n'existe pas — brief §7), créer un
premier utilisateur directement en base, ou relancer le seed avec
`SEED_DEV_ADMIN=true pnpm prisma:seed` pour obtenir le même compte de
développement que sur Codespaces (`admin@navi.local` / `navi-codespaces-dev`).

## Principes de développement

- Le référentiel Excel (`docs/reference/referentiel-metier-navi.xlsx`) est la source de vérité pour les règles métier — ne pas deviner une règle depuis le code.
- Le moteur Playwright existant (`docs/reference/moteur-experience-existant.js`) est un actif extrait progressivement, pas réécrit.
- Aucune décision produit/métier validée n'est modifiée silencieusement — toute divergence est signalée avant d'être tranchée.
