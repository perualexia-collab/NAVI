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

### Retour immédiat : réponse tronquée / raisonnement brut (2026-09-03)

Premier test réel utilisateur : connectivité OK (`✅ Réponse reçue`),
mais le texte renvoyé était le raisonnement interne brut de Qwen3.6
(balises `<think>...`), coupé avant la réponse finale — `qwen/qwen3.6-27b`
est un modèle "thinking" qui produit un raisonnement avant sa réponse,
et `maxTokens: 100` (trop bas) coupait la génération en plein
raisonnement.

- `LlmCompletionRequest` : nouveau champ optionnel `reasoningFormat`
  (`"hidden" | "parsed" | "raw"`) — extension Groq non-standard côté
  OpenAI, ajoutée au corps de la requête uniquement si l'appelant la
  demande explicitement (sans effet sur un provider/modèle qui ne la
  reconnaît pas, donc ne recouple pas l'adaptateur générique à Groq).
- `test-connection.ts` : passe désormais `reasoningFormat: "hidden"`
  (ne renvoie que la réponse finale, jamais le raisonnement) et
  `maxTokens: 400` (marge confortable).
- **Retour de sécurité** : la clé Groq de l'utilisateur est apparue en
  clair dans la conversation (terminal collé après un `cat >> .env`).
  Elle n'a jamais été committée, mais l'utilisateur a été invité à la
  régénérer sur console.groq.com/keys par prudence, et à éditer
  `backend/.env` directement (VS Code) plutôt que via une commande
  affichée à l'écran pour la suite.

Backend typecheck/build passent après cette correction.

## H2 — Context Builder (2026-09-03)

Le jeu fermé de fonctions qui donne à Ask NAVI accès aux données NAVI
(§09 Architecture Proposal) — jamais de requête Prisma libre depuis
l'orchestration Ask NAVI (à construire), jamais un second appel LLM
pour "décider quoi chercher". Les 5 fonctions construites reprennent
exactement les noms d'exemple du §09 :

- **`getHotelHealth(hotelId)`** — snapshot du dernier scan connu d'un
  hôtel : score/niveau, ventilation par pilier, KPI, signaux actifs.
  `null` seulement si l'hôtel n'existe pas ; un hôtel jamais scanné
  renvoie un objet valide avec `hasScan: false` (pas `null`), pour que
  l'orchestration puisse distinguer "hôtel inconnu" de "pas encore
  scanné" sans avoir à re-vérifier l'existence séparément.
- **`getScanHistory(hotelId, limit?)`** — historique des derniers scans
  terminés (mêmes 3 statuts que "Historique des scans" côté fiche
  hôtel), pour "comment a évolué le score de tel hôtel ?".
- **`getPortfolioSignals(userId, portfolioId)`** — signaux actifs des
  hôtels d'un portefeuille, groupés par hôtel. Un portefeuille
  appartient à un seul utilisateur (`Portfolio.ownerId`, comme
  `/api/portfolios`) : `null` si `userId` ne correspond pas au
  propriétaire — même traitement qu'un portefeuille inexistant, pour ne
  pas laisser un utilisateur déduire l'existence du portefeuille d'un
  autre par la forme de la réponse.
- **`getTopOpportunities(limit?)`** — meilleures opportunités actives,
  org-wide (les hôtels n'appartiennent à aucun utilisateur en
  particulier, comme `/api/dashboard`). Reprend le principe de priorité
  du dashboard (P11 avec un résultat ⭐ mis en avant = "high") mais
  **réimplémenté indépendamment** plutôt que partagé avec
  `dashboard.ts` — la forme de sortie utile à Ask NAVI diffère de celle
  du dashboard, et modifier une route déjà validée par l'utilisateur
  pour un gain de factorisation à ce stade n'était pas justifié. À
  fusionner si un troisième appelant apparaît avec le même besoin exact.
- **`getHotelsWithoutRecentScan(days?)`** — hôtels jamais scannés ou pas
  scannés depuis plus de `days` jours, pour "quels hôtels ai-je oublié
  de scanner ?".

**Règle de sécurité produit reprise du brief** : aucune de ces fonctions
ne renvoie de `playbookId` ("P06"...) — le brief interdit explicitement
de l'exposer à l'utilisateur final, et Ask NAVI répond à l'utilisateur
final. Seuls des libellés déjà humains (nom du signal, texte de
recommandation) sortent du Context Builder.

**Signaux "actifs" uniquement** (ni Traité ni Ignoré) dans
`getHotelHealth`, `getPortfolioSignals` et `getTopOpportunities` — même
règle que le dashboard (retours réels 2026-09-03). Choix cohérent avec
l'esprit de ces fonctions ("qu'est-ce qui mérite mon attention"), pas
avec l'exhaustivité de la fiche hôtel elle-même.

**Ce qui n'est toujours pas construit** : le routeur d'intention (quelle
fonction appeler selon la question posée), le prompt système "NAVI
décide, Qwen explique", la route API `/api/ask-navi`, le branchement
frontend. `backend/ai/ask-navi/` reste vide.

**Test** : `pnpm --filter @navi/backend ai:test-context-builder` — lit
de vraies données (premier hôtel, premier portefeuille trouvés en base),
n'appelle aucun LLM (contrairement à `ai:test-connection`), affiche le
JSON renvoyé par chacune des 5 fonctions. Aucune limite Groq consommée
par ce test.

Backend typecheck/build passent. Non testé contre de vraies données
depuis cet environnement (pas de PostgreSQL accessible ici) — à valider
par l'utilisateur dans son Codespace.

## H3/H4 — routeur d'intention, orchestration, route API, branchement frontend (2026-09-03)

Les 4 briques manquantes pour rendre Ask NAVI réellement utilisable
dans l'UI, construites en une passe (demande explicite : "on enchaîne
sur ces 4 étapes").

**H3 — `backend/ai/ask-navi/route-intent.ts`** — le routeur d'intention
du §09 : mots-clés + entités reconnues, **jamais** un second appel LLM
pour "décider quoi chercher" (règle explicite du brief). Reconnaissance
d'entité volontairement simple (sous-chaîne dans la question,
normalisée sans accents ; la correspondance la plus longue gagne parmi
les hôtels/portefeuilles existants) — un vrai NLU serait disproportionné
pour un premier jeu de questions. `routeIntent(question, userId)` :
1. Hôtel reconnu dans la question → `hotel-history` (mots-clés
   "historique/évolution/tendance") ou `hotel-health` par défaut.
2. Sinon portefeuille reconnu (scopé à l'utilisateur, comme
   `/api/portfolios`) → `portfolio-signals`.
3. Sinon mots-clés "opportunité/potentiel/convertir" →
   `top-opportunities`.
4. Sinon mots-clés "pas scanné/oublié/dernier scan" →
   `hotels-without-recent-scan`.
5. Sinon `unknown` — y compris un mot-clé "alerte/vigilance/signal" SANS
   portefeuille reconnu : `getPortfolioSignals` exige un portefeuille,
   pas de 6ᵉ fonction "tous portefeuilles" inventée pour ce cas.

**H4a — `backend/ai/ask-navi/answer-question.ts`** — orchestration :
`routeIntent()` → fonction du Context Builder correspondante → prompt
système "NAVI décide, Qwen explique" (interdiction explicite de
recalculer un chiffre, interdiction de mentionner un playbookId,
consigne de demander une précision plutôt que répondre dans le vide si
`intent: "unknown"`) → `LlmService.complete()` avec
`reasoningFormat: "hidden"` (retour réel H1 — Qwen3.6 est un modèle
"thinking"). Renvoie aussi des `sources` (libellé + détail humain, ex.
"Hôtel Louis II" / "Santé CRM, KPI et signaux actifs") pour le panneau
"Sources utilisées" du frontend — pas encore de lien cliquable
(`références structurées que NAVI transforme en liens`, §09) : juste du
texte pour cette passe, le lien profond est un raffinement ultérieur.

**H4b — `backend/src/api/routes/ask-navi.ts`** — `POST /api/ask-navi`,
enregistrée dans `app.ts`. `503` (pas `500`) si aucun provider LLM
n'est configuré — état légitime tant que l'utilisateur n'a pas renseigné
sa clé (`GROQ_API_KEY` optionnelle), pas une panne serveur ; `502` si le
LLM Service échoue une fois configuré (timeout, erreur Groq...).

**H4c — `frontend/src/pages/AskNavi.tsx`** — remplace le placeholder
honnête "NAVI n'est pas encore connecté à un fournisseur LLM" par un
vrai appel à `POST /api/ask-navi` (`useMutation`). Chaque échange suit
son propre statut (`pending`/`success`/`error`) plutôt qu'un seul état
de mutation partagé, pour permettre plusieurs questions à la suite sans
attendre. Le panneau "Sources utilisées" devient dynamique (sources du
dernier échange réussi) au lieu d'afficher `mockAnswer.sources` en dur.
"Questions suggérées" et "Historique des conversations" restent
inchangés (le premier est un jeu d'exemples statique assumé, le second
est purement local à la session — jamais demandé de le persister côté
backend).

**Ce qui reste** : liens cliquables sur les sources (au lieu de texte
brut), persistance de l'historique de conversation côté backend (si
jamais demandé), affinage du routeur d'intention à l'usage réel plutôt
qu'en devinant à l'avance quelles questions seront posées.

Backend et frontend typecheck/build passent. **Non testé de bout en
bout contre de vraies données** (pas de PostgreSQL/Groq accessibles
depuis cet environnement) — à valider par l'utilisateur : poser une
vraie question mentionnant un hôtel existant, une question
"opportunités", une question hors sujet (doit demander une précision
plutôt qu'inventer une réponse).

### Retour immédiat : bulle vide + double-soumission (2026-09-03)

Premier test réel : "quelles sont mes opportunités ?" → bulle NAVI vide
(aucun texte, aucune erreur). Une question mentionnant un hôtel a été
soumise deux fois (même texte, deux bulles) → les deux ont échoué en
502 "Ask NAVI n'a pas pu répondre".

- **Bulle vide** : cause probable — `reasoningFormat: "hidden"`
  masque le raisonnement de Qwen3.6 mais ne l'empêche pas de le
  produire ; ce raisonnement invisible consomme quand même le budget
  `maxTokens` (documentation Groq). `maxTokens: 800` pouvait donc être
  épuisé avant la moindre réponse visible. Remonté à `2048`. Filet de
  sécurité ajouté en plus, quelle que soit la cause réelle : si le texte
  renvoyé est vide, `answer-question.ts` renvoie un message honnête
  ("NAVI n'a pas réussi à formuler de réponse complète...") plutôt
  qu'une bulle vide.
- **Double-soumission** : `isAsking` (dérivé de l'état React) pouvait ne
  pas encore refléter le premier envoi au moment d'un second appel
  synchrone très rapproché (deux `Entrée` pressées vite). Remplacé par
  une garde `useRef` (`sendingRef`), qui bloque toute nouvelle
  soumission tant que la précédente n'est pas *settled* — indépendant du
  cycle de rendu, élimine la course.
- **502 sur la question hôtel** : cause non identifiée avec certitude
  depuis cet environnement (pas d'accès aux logs backend de
  l'utilisateur) — `request.log.error(error)` dans
  `backend/src/api/routes/ask-navi.ts` doit avoir tracé la vraie erreur
  côté terminal. À investiguer avec ce log si le problème persiste après
  ces deux correctifs (une partie du symptôme peut avoir été la
  double-soumission ci-dessus, qui aurait pu doubler la charge sur le
  quota Groq 30 req/min en quelques secondes).

Backend et frontend typecheck/build passent après ces correctifs.

### Retour immédiat : 429 — vraie cause du 502 identifiée par les logs (2026-09-03)

Log backend fourni par l'utilisateur — diagnostic certain cette fois :

```
LLM Service (429) : {"error":{"message":"Rate limit reached for model
`qwen/qwen3.6-27b` ... on output tokens per minute (OTPM): Limit 1000,
Used 366, Requested 800. Please try again in 9.96s. ..."}}
```

Le plan gratuit Groq limite **qwen/qwen3.6-27b à 1000 tokens de sortie
par minute (OTPM)**, tous appels confondus. Or `reasoningFormat:
"hidden"` masque le raisonnement de Qwen3.6 sans l'empêcher d'être
généré — il consomme quand même ce quota de 1000 OTPM. Une seule
question avec contexte pouvait déjà en utiliser plusieurs centaines,
laissant peu de marge pour la suivante dans la même minute. **Le
correctif précédent (maxTokens → 2048) aggravait le problème** : une
seule requête pouvait demander plus que le quota total disponible et se
faire rejeter systématiquement, même sur une minute fraîche.

Vrai correctif, trouvé en vérifiant la doc Groq sur le raisonnement
(console.groq.com/docs/reasoning) : pour la famille Qwen3.x sur Groq, un
paramètre distinct **`reasoning_effort: "none"` désactive réellement le
raisonnement** (contrairement à `reasoning_format: "hidden"`, qui
l'exécute puis le cache). C'est la bonne solution pour Ask NAVI, qui n'a
pas besoin de réflexion profonde — il reformule un résultat déjà
calculé, jamais il ne raisonne lui-même (cf. prompt système).

- `LlmCompletionRequest` : nouveau champ optionnel `reasoningEffort`
  (`"none" | "low" | "medium" | "high" | "xhigh"`) — même principe que
  `reasoningFormat` (extension non-standard, absente du corps si non
  demandée explicitement).
- `answer-question.ts` : `reasoningEffort: "none"` + `maxTokens` revenu
  à `600` (raisonnable maintenant que le raisonnement invisible ne le
  consomme plus) ; garde aussi `reasoningFormat: "hidden"` par sécurité
  (sans effet si le raisonnement est déjà désactivé).
- `LlmRateLimitError` (nouvelle classe, `llm-service/types.ts`) — un 429
  provider est un état attendu et temporaire sur un plan gratuit, pas
  une panne. La route `/api/ask-navi` le distingue maintenant :
  **429** + "Limite de requêtes Groq atteinte (plan gratuit) — réessaie
  dans quelques secondes." au lieu du 502 générique trompeur.

Backend typecheck/build passent. **Non re-testé contre de vraies
données** (dépend de la clé Groq de l'utilisateur) — à valider : une
question devrait maintenant consommer beaucoup moins de tokens de
sortie et laisser de la marge pour plusieurs questions à la suite dans
la même minute.

### Retour immédiat : reasoningEffort retiré, comportement imprévisible chez Groq (2026-09-03)

Premier test après le correctif ci-dessus : "quelles sont mes
opportunités ?" a fonctionné parfaitement (vraie réponse, bien
formulée, citant les vrais hôtels/volumes). Mais la question suivante,
20s plus tard ("oui tu peux détailler les actions"), a échoué :

```
LLM Service (429) : "Request too large for model qwen/qwen3.6-27b ...
on output tokens per minute (OTPM): Limit 1000, Requested 1296. ..."
```

Aucun champ "Used" cette fois (contrairement au 429 précédent) : Groq a
jugé CETTE requête, à elle seule, trop grande — alors que `maxTokens`
valait 600 dans le code. `reasoningEffort: "none"` était le seul autre
paramètre présent. Sans certitude absolue (boîte noire côté Groq), le
plus probable : la présence de `reasoning_effort` fait gonfler
l'estimation interne de Groq bien au-delà de `maxTokens` pour ce
modèle — un comportement contradictoire avec la doc/les échos trouvés
en ligne (une source dit "reasoning_effort désactive vraiment le
raisonnement pour Qwen3", une autre dit qu'il n'est supporté que par
les modèles GPT-OSS). Plutôt que de continuer à deviner, **retiré**
de l'appel : `reasoningEffort` reste disponible dans
`LlmCompletionRequest` (utile si un autre provider/modèle le supporte
proprement) mais n'est plus envoyé par `answer-question.ts`.
`maxTokens` abaissé à `450` (marge supplémentaire dans le quota de
1000 OTPM, avec `reasoningFormat: "hidden"` seul — le seul réglage qui
s'est comporté de façon prévisible jusqu'ici, "Requested" annoncé par
Groq correspondant exactement à la valeur demandée).

**Limitation produit à noter, distincte de ce bug** : Ask NAVI n'a pas
de mémoire conversationnelle — chaque question part d'un contexte
neuf (`routeIntent()` ne connaît rien des échanges précédents dans le
fil). "Détaille les actions" sans nommer l'hôtel retombera donc sur
`unknown` (aucun hôtel/portefeuille/mot-clé reconnu dans cette phrase
seule) et demandera une précision plutôt que de poursuivre sur "Lilas
Blanc" mentionné juste avant. Non corrigé ici — hors du périmètre des 4
étapes demandées, mais à garder en tête pour un futur incrément
(passer les derniers échanges du fil au LLM Service).

Backend typecheck/build passent.

## H5 — mémoire conversationnelle + accès élargi aux données (2026-09-03)

Demande explicite après validation d'Ask NAVI en conditions réelles :
mémoire conversationnelle, et deux trous concrets rencontrés en test —
"quels hôtels n'ont pas encore été testés ?" (contexte vide, aucun
mot-clé reconnu) et l'incapacité à additionner le CA CRM de plusieurs
hôtels d'un portefeuille.

**Mémoire conversationnelle** :
- `POST /api/ask-navi` accepte désormais `history` (derniers échanges
  question/réponse du même fil, question la plus ancienne en premier).
  Toujours géré côté frontend uniquement (`AskNavi.tsx`, `MAX_HISTORY_TURNS
  = 3`) — jamais persisté en base, comme le reste de cette page.
- `answer-question.ts` : les échanges reçus sont injectés comme de vrais
  tours `user`/`assistant` dans les messages envoyés au LLM (avant la
  question courante), pour que Qwen ait une vraie continuité de fil.
- `route-intent.ts` : `routeIntent(question, userId, recentHistoryText?)`
  — si la question seule ne nomme aucun hôtel/portefeuille, retente sur
  question + historique récent concaténé, pour qu'une relance elliptique
  ("détaille les actions") reste rattachée au bon hôtel/portefeuille. La
  question courante l'emporte toujours : un historique périmé ne peut
  jamais "voler" l'entité d'une nouvelle question qui en nomme une autre
  explicitement (l'historique n'est consulté qu'en second essai, jamais
  en premier).

**Accès élargi aux données** — deux nouvelles fonctions Context Builder :
- **`getAllHotelsOverview()`** — tous les hôtels (portefeuille(s),
  dernier scan, statut, santé). Devient le contexte de repli par défaut
  de `routeIntent()` : l'intention `"unknown"` a été retirée et remplacée
  par `"org-overview"`, qui utilise TOUJOURS cette fonction plutôt qu'un
  contexte vide. Ask NAVI a désormais toujours de vraies données sous la
  main, même sur une question mal formulée ou hors des mots-clés
  explicitement prévus — c'est la correction directe du symptôme "hôtels
  pas encore testés" (le mot "testé" n'était simplement pas dans la liste
  de synonymes de "scanné", ajouté au passage à `WITHOUT_SCAN_KEYWORDS`).
- **`getPortfolioFinancials(userId, portfolioId)`** — nouvelle intention
  `"portfolio-financials"` (portefeuille reconnu + mot-clé financier :
  "CA CRM", "chiffre d'affaires", "revenu", "réservations"...). Pour
  chaque hôtel du portefeuille : les 6 KPI business (mêmes que
  `PerformanceBusinessCard` côté frontend) + un total déjà additionné
  par NAVI (jamais par le LLM — "NAVI décide, Qwen explique", §09). Un
  hôtel jamais scanné ou sans stats marketing est compté à part
  (`hotelsWithoutData`), jamais traité comme 0 pour ne pas fausser le
  total. Le prompt système a été renforcé en conséquence : "tu ne
  calcules JAMAIS toi-même... une somme" (ajouté explicitement, l'ancien
  prompt ne parlait que de score/pourcentage/montant/évolution).

**Non fait, volontairement** : pas de fonction générique "somme
n'importe quel KPI" — seuls les 6 KPI business (montants/comptages
absolus, sommables sans ambiguïté) sont agrégés. Les KPI en pourcentage
(taux d'activabilité, part OTA...) ne le sont pas : une somme de
pourcentages n'a pas de sens, et rien dans le référentiel ne distingue
aujourd'hui les deux catégories côté backend (seulement en dur côté
frontend, `PERCENT_KPI_IDS`) — pas dupliqué ici sans un vrai besoin
exprimé. Pas de vue "toutes les alertes/vigilances org-wide" (similaire
à `getTopOpportunities` mais pour ALERT/VIGILANCE) — pas explicitement
demandé, `getAllHotelsOverview()` couvre déjà le cas par défaut.

Backend et frontend typecheck/build passent. **Non testé contre de
vraies données** — à valider : "quels hôtels n'ont pas été testés ?"
(devrait maintenant lister les hôtels via `org-overview` même sans le
mot "scanné"), une question de CA sur un portefeuille nommé
explicitement, puis une relance elliptique après une réponse sur un
hôtel précis ("et son historique ?" sans renommer l'hôtel).
