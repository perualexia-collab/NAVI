# NAVI — Navigate. Analyze. Act.

Copilote CRM hôtelier posé au-dessus d'Expérience (D-EDGE). Voir [`docs/architecture-proposal.html`](docs/architecture-proposal.html) pour l'architecture validée et le plan de développement (Phase A → I).

## Statut

**Phase C** validée avec de vraies données Expérience (voir [`docs/reference/phase-c-real-connection-notes.md`](docs/reference/phase-c-real-connection-notes.md)). **Phase D — scan multi-hôtels**, livrée (D1 infra Redis/BullMQ, D3 robustesse, D2 progression temps réel — voir [`docs/reference/phase-d-notes.md`](docs/reference/phase-d-notes.md)). **Phase E — moteur métier**, terminée et validée avec de vraies données Expérience (E1, E2, E3-P11, E3-P10) — voir [`docs/reference/phase-e-notes.md`](docs/reference/phase-e-notes.md). **Phase F — Audiences**, F1 à F5 validées avec de vraies données Expérience (création de liste, suivi d'action, historique des scans, estimation de temps, dashboard réel). **Phase F6 — suppression réelle (hôtels/utilisateurs) + CRM Health réel**, construite (backend + frontend, typecheck/build OK), pas encore testée — voir les sections Phase F du même document. **Phase H — Ask NAVI (démarrée en avance)**, construite de bout en bout : H1 — LLM Service provider-agnostic + adaptateur Groq/Qwen (plan gratuit), connectivité validée avec de vraies données. H2 — Context Builder (5 fonctions fermées). H3 — routeur d'intention (mots-clés + entités, sans second appel LLM). H4 — orchestration + route `POST /api/ask-navi` + branchement frontend (page Ask NAVI). Construit et typecheck/build OK, **pas encore testé de bout en bout contre de vraies données** — voir [`docs/reference/phase-h-notes.md`](docs/reference/phase-h-notes.md).

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

Ce compte et l'hôtel pilote (`Hôtel Louis II`) sont recréés à chaque
démarrage du Codespace si absents (`.devcontainer/post-start.sh`) — rien à
faire manuellement après la première fois.

## Connecter NAVI à Expérience (données réelles)

Une seule connexion manuelle est nécessaire (2FA) ; ensuite, tous les scans
lancés depuis l'UI NAVI (Paramètres → Hôtels → ... → CRM Health → "Lancer un
nouveau scan") réutilisent automatiquement la session, en headless.

1. Renseigner dans `backend/.env` (jamais committé) :
   ```
   EXPERIENCE_SERVICE_ACCOUNT_EMAIL=...
   EXPERIENCE_SERVICE_ACCOUNT_PASSWORD=...
   ```
   Optionnel : sans ces deux valeurs, la connexion reste possible mais 100%
   manuelle (email et mot de passe compris). Avec elles, seuls email/mot de
   passe sont pré-remplis — **la 2FA reste toujours manuelle**.
2. Dans le terminal du Codespace :
   ```bash
   pnpm --filter @navi/backend connect:experience
   ```
   Ce script ouvre un Chromium **visible** (pas headless), affiché sur un
   écran virtuel (Xvfb) exposé via noVNC.
3. Onglet **PORTS** → port **6080** → ouvrir dans le navigateur, puis
   ajouter `/vnc.html` à l'URL affichée. Se connecter (2FA comprise) dans
   ce navigateur distant.
4. Une fois l'interface Expérience authentifiée détectée, le script
   l'affiche dans le terminal et se termine tout seul — la session est
   persistée dans `backend/experience-profile/` (jamais committé). Fermer
   l'onglet noVNC à ce moment-là est sans risque : Xvfb/x11vnc/noVNC sont
   des processus indépendants du client noVNC, et ne s'arrêtent pas avec
   lui.
5. Retour dans NAVI (port 5173) : sélectionner l'hôtel pilote dans
   **CRM Health**, choisir une période, cliquer **"Lancer un nouveau
   scan"** — le scan tourne headless, sans repasser par noVNC.

La session Expérience peut expirer : si un scan échoue avec une erreur
d'authentification, relancer l'étape 2.

## Connecter NAVI à un LLM (Ask NAVI)

Ask NAVI (page dédiée du frontend) est branché à de vraies données —
une clé Groq est nécessaire pour qu'il puisse répondre.

1. Créer une clé API sur [console.groq.com/keys](https://console.groq.com/keys)
   (compte gratuit).
2. Renseigner dans `backend/.env` (jamais committé — voir `.gitignore`) :
   ```
   GROQ_API_KEY=...
   ```
   Le reste (`LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_MODEL`) a déjà une
   valeur par défaut dans `.env.example`, à copier telle quelle dans
   `backend/.env` si elle n'y est pas déjà (`http-openai-compatible` /
   `https://api.groq.com/openai/v1` / `qwen/qwen3.6-27b`).
3. Dans le terminal du Codespace :
   ```bash
   pnpm --filter @navi/backend ai:test-connection
   ```
   Envoie un unique message de test et affiche la réponse du modèle dans
   le terminal. Rien n'est écrit en base, rien n'est exposé au frontend —
   voir [`docs/reference/phase-h-notes.md`](docs/reference/phase-h-notes.md)
   pour le détail de l'architecture (`backend/ai/llm-service/`).

Le Context Builder (`backend/ai/context-builder/` — les fonctions qui
liront les vraies données CRM Health/signaux pour Ask NAVI) se teste
séparément, sans toucher au LLM :
```bash
pnpm --filter @navi/backend ai:test-context-builder
```

## Test E2E réel (local, hors CI)

```bash
pnpm --filter @navi/backend test:e2e
```

Rejoue le vertical slice complet sur l'hôtel pilote via une vraie session
Expérience déjà authentifiée (étapes ci-dessus). Ignoré proprement (jamais
en échec) si `backend/experience-profile/` est absent ou la session
expirée — voir `backend/experience/__tests__/vertical-slice.e2e.test.ts`.
Ne tourne pas en CI (nécessite la 2FA manuelle en amont).

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
