# Phase H — Ask NAVI / LLM Service

## H1 — LLM Service : abstraction + adaptateur Groq/Qwen, test minimal de connectivité (2026-09-03)

Démarré en avance sur l'ordre indicatif du plan (Phase H prévue après G),
à la demande explicite de l'utilisateur, qui a créé un compte Groq et
généré une clé API et veut valider le tuyau `backend → Groq → Qwen` avant
de brancher le Context Builder (données CRM Health/signaux/
recommandations) dans Ask NAVI. Rien de plus construit à ce stade —
volontairement : pas de route API, pas de frontend, pas d'accès à
Prisma depuis `backend/ai/`.

### Ce qui existait déjà

`backend/ai/{llm-service,context-builder,ask-navi}/` — dossiers vides,
scaffoldés dès A1, jamais remplis. `.env.example` portait déjà
`LLM_PROVIDER` / `LLM_BASE_URL` / `LLM_MODEL` (vides). L'architecture
cible était déjà entièrement spécifiée dans
`docs/architecture-proposal.html` (§09) :

- **Ask NAVI → Context Builder → LLM Service → provider concret.**
- `LLM Service` expose une interface unique (`complete(prompt, context)`)
  que des adaptateurs implémentent séparément — le choix du provider est
  une question de configuration, jamais un couplage en dur.
- « NAVI décide, Qwen explique » — le score/signal/sévérité sont calculés
  par le moteur métier déterministe de NAVI ; le LLM n'a accès qu'aux
  résultats déjà calculés et les met en mots.
- Le Context Builder ne fait pas de recherche libre : un routeur
  d'intention choisit parmi un jeu fermé de fonctions
  (`getHotelHealth`, `getPortfolioSignals`...) — pas un second appel LLM
  pour « décider quoi chercher ».

Cette session H1 construit uniquement la première brique
(`LLM Service`) — le Context Builder et l'orchestration Ask NAVI restent
à construire (dossiers toujours vides).

### Modèle Qwen retenu

Vérifié le 2026-09-03 (recherche web — pas dans le référentiel du
projet) : Groq a déprécié `qwen/qwen3-32b` le 2026-06-17. Le modèle Qwen
actuellement actif sur le plan gratuit Groq est **`qwen/qwen3.6-27b`**
(30 req/min, 6000 tokens/min, ~1000 req/jour sur le plan gratuit —
largement suffisant pour ce test et pour un usage Ask NAVI raisonnable
par la suite). **À revérifier sur
[console.groq.com/docs/models](https://console.groq.com/docs/models) si
Groq fait à nouveau évoluer son catalogue** — c'est pour ça que le
modèle est piloté uniquement par `LLM_MODEL` (aucun nom de modèle en dur
dans le code), un changement futur ne touche qu'une ligne de config.

### Ce qui a été construit

- `backend/ai/llm-service/types.ts` — interface `LlmService` /
  `LlmCompletionRequest` / `LlmCompletionResult`, strictement conforme au
  contrat `complete()` du §09.
- `backend/ai/llm-service/http-openai-compatible-provider.ts` —
  **adaptateur générique**, zéro logique spécifique à Groq : parle à
  n'importe quel endpoint `/chat/completions` compatible OpenAI
  (`baseUrl`/`model`/`apiKey` en configuration). Groq n'est qu'une
  instance de cet adaptateur, jamais une classe à part — c'est ce qui
  évite de coupler NAVI directement à Groq (demande explicite). Timeout
  20s par défaut (`AbortController`) : un test de connectivité ne doit
  jamais rester bloqué en silence (cf. retour réel Phase F9 — bouton
  "Tester la connexion" Expérience resté figé 3 min sans indication).
- `backend/ai/llm-service/index.ts` — `createLlmService(env)`, fabrique
  qui choisit le provider par configuration (`LLM_PROVIDER`). Un seul
  provider supporté aujourd'hui (`"http-openai-compatible"`), mais
  l'appelant (`ai:test-connection`, plus tard Ask NAVI) ne connaît que
  cette fabrique — jamais `HttpOpenAiCompatibleProvider` directement.
- `backend/ai/test-connection.ts` — script minimal (`pnpm --filter
  @navi/backend ai:test-connection`) : charge l'env, construit le LLM
  Service, envoie un seul message de test, affiche la réponse. Ne touche
  à aucune donnée NAVI (pas de Prisma) — c'est le test du tuyau, pas
  d'Ask NAVI.
- `backend/src/config/env.ts` — `LLM_PROVIDER` / `LLM_BASE_URL` /
  `LLM_MODEL` / `GROQ_API_KEY` ajoutés au schéma zod, **tous optionnels** :
  sans eux, le reste de NAVI démarre et fonctionne normalement (aucune
  route ne dépend de l'IA pour l'instant).

### Sécurité de la clé

- `GROQ_API_KEY` vit uniquement dans `backend/.env` (déjà dans
  `.gitignore`, jamais committé — comportement identique à
  `SESSION_SECRET`/`EXPERIENCE_SERVICE_ACCOUNT_PASSWORD`).
- Jamais loguée : transmise uniquement dans l'en-tête `Authorization`
  d'une requête sortante ; les seuls `console.log`/`console.error` du
  script affichent le provider/modèle et le texte de réponse, jamais la
  clé. Le corps d'une éventuelle erreur Groq ne peut pas non plus la
  contenir (elle n'est jamais envoyée dans le corps de la requête).
- Jamais exposée au frontend : `backend/ai/` n'est importé par aucun
  code frontend ni `shared/` ; aucune route API n'existe encore pour Ask
  NAVI (à construire lors du branchement du Context Builder).

### Non fait à ce stade (volontairement)

- Pas de Context Builder — aucune fonction `getHotelHealth()` etc.
  n'existe encore.
- Pas de route API `/api/ask-navi` — le frontend Ask NAVI reste 100%
  mocké (`frontend/src/mock/ask-navi.ts`, Phase B4) jusqu'au prochain
  incrément.
- Pas de prompt système « NAVI décide, Qwen explique » — le prompt du
  script de test est un prompt de diagnostic générique, pas le futur
  prompt système Ask NAVI.

Backend typecheck/build passent. Test réel du script
(`ai:test-connection`) à faire par l'utilisateur une fois sa clé
renseignée dans son Codespace — non exécutable depuis cet environnement
(pas d'accès à sa clé, et égress réseau vers `api.groq.com` non
disponible dans cet environnement de développement).
