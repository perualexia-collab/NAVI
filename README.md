# NAVI — Navigate. Analyze. Act.

Copilote CRM hôtelier posé au-dessus d'Expérience (D-EDGE). Voir [`docs/architecture-proposal.html`](docs/architecture-proposal.html) pour l'architecture validée et le plan de développement (Phase A → I).

## Statut

**Phase A — Foundations**, en cours.

## Structure

```
frontend/   React + TypeScript + Vite — desktop-first
backend/    Node.js + TypeScript + Fastify
  src/               API, services métier (scoring, signaux)
  experience/        moteur Playwright (à extraire de docs/reference/moteur-experience-existant.js)
  playbooks/          P01…P12, orchestration métier
  scans/              queue BullMQ, workers, ETA
  ai/                  Ask NAVI, Context Builder, LLM Service
  prisma/              schéma + migrations + seed
shared/     Types TypeScript partagés frontend/backend
docs/reference/   Brief, référentiel métier Excel, moteur Playwright existant — sources de vérité
```

## Prérequis

- Node.js ≥ 20, pnpm ≥ 9
- Docker (PostgreSQL + Redis en local)

## Démarrage local

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres redis
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev:backend    # http://localhost:4000
pnpm dev:frontend   # http://localhost:5173
```

## Principes de développement

- Le référentiel Excel (`docs/reference/referentiel-metier-navi.xlsx`) est la source de vérité pour les règles métier — ne pas deviner une règle depuis le code.
- Le moteur Playwright existant (`docs/reference/moteur-experience-existant.js`) est un actif à extraire progressivement, pas à réécrire.
- Aucune décision produit/métier validée n'est modifiée silencieusement — toute divergence est signalée avant d'être tranchée.
