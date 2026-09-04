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

### Retour immédiat : 3 réponses vides d'affilée après H5 (2026-09-03)

Trois questions différentes ("CA CRM du portefeuille GHP" ×2, "potentiel
de conversion OTA") ont toutes échoué avec le message de repli ("NAVI
n'a pas réussi à formuler..."), jamais une erreur — donc bien un 200
avec texte vide à chaque fois. Logs serveur (`statusCode: 200`,
`responseTime` ~1000-1300ms) : nettement plus rapide que les réponses
réussies observées avant H5 (1900-3400ms), ce qui pointe vers une
génération coupée très tôt plutôt qu'une vraie réponse ignorée.
Hypothèse la plus probable, non confirmée avec certitude (les logs
pino ne capturaient ni `usage` ni `finish_reason` — juste le
statusCode) : le contexte JSON est devenu plus volumineux depuis H5
(org-overview/portfolio-financials, + l'historique de conversation
maintenant injecté), ce qui pousse Qwen3.6 à "réfléchir" davantage
avant de répondre — `maxTokens: 450` ne laissait plus assez de marge
pour ce raisonnement caché sur ce type de question précis.

Deux changements :
- **Diagnostic instrumenté** plutôt qu'une nouvelle correction devinée
  à l'aveugle (2 rounds précédents corrigés sur la base d'un log
  précis, ça a marché à chaque fois — mieux vaut refaire pareil) :
  `LlmCompletionResult` porte maintenant `finishReason` (`finish_reason`
  du payload Groq), et `answer-question.ts` logue `console.warn(...)`
  avec `finishReason`/`usage`/`intent` dès que le texte revient vide.
  Si ça se reproduit, le terminal backend affichera directement la
  cause exacte au lieu d'un simple `statusCode: 200`.
- **`maxTokens` remonté à 900** (depuis 450) — reste sous le seuil
  d'admission ~1000 OTPM observé pour une requête isolée (l'incident
  `reasoningEffort` plus haut), donne beaucoup plus de marge de
  raisonnement caché. Contrepartie assumée : moins de questions
  possibles à la suite dans la même fenêtre de 60s avant un 429 (déjà
  géré proprement, voir plus haut) — arbitrage nécessaire tant que le
  raisonnement caché de Qwen3.6 reste incompressible sur ce plan
  gratuit.

Backend typecheck/build passent. Non re-testé.

### Retour immédiat : preuve directe par les logs — "/no_think" plutôt que reasoningEffort (2026-09-03, 3e round)

Le diagnostic instrumenté ci-dessus a immédiatement donné la réponse,
sans ambiguïté cette fois — même sur une question qui avait déjà
fonctionné auparavant ("quelles sont mes opportunités ?") :

```
[ask-navi] Réponse vide du LLM {
  intent: 'top-opportunities',
  finishReason: 'length',
  usage: { promptTokens: 721, completionTokens: 900, totalTokens: 1621 },
  questionLength: 29
}
```

`completionTokens: 900` = exactement `maxTokens`. Confirmation
définitive : le raisonnement caché de Qwen3.6 (masqué par
`reasoningFormat: "hidden"` mais jamais empêché d'être généré)
consomme À LUI SEUL tout le budget de tokens sur une question avec du
contexte réel — remonter encore `maxTokens` n'aurait rien réglé (et se
heurte de toute façon au seuil d'admission ~1000 OTPM par requête, cf.
l'incident `reasoningEffort` de la note précédente).

Log complet fourni par l'utilisateur : 4 requêtes en ~5 minutes,
2 × 429 (`Used 442, Requested 900` puis `Used 589, Requested 558` —
la fenêtre glissante de 60s se reconstitue vite, mais 900 de budget
par appel ne laisse presque aucune marge pour enchaîner), 1 × texte
vide (`finishReason: "length"` ci-dessus), 1 × réponse réelle. Sur 4
tentatives, une seule a effectivement répondu correctement.

**Nouvelle approche, différente de `reasoningEffort` (retiré
précédemment)** : `/no_think` ajouté en toute fin du prompt système —
le "soft switch" que le chat template de Qwen3.x reconnaît nativement
dans le TEXTE du prompt pour désactiver le mode réflexion, par
opposition à `reasoning_effort`/`chat_template_kwargs` qui sont des
champs de requête spéciaux que Groq traite (mal, semble-t-il) de façon
spécifique. `/no_think` n'est qu'une ligne de texte dans le contenu
envoyé — invisible pour le système de quota de Groq, qui ne devrait
donc plus pouvoir gonfler son estimation comme avec `reasoningEffort`.

`maxTokens` redescendu de 900 à 550 : si `/no_think` fonctionne, une
réponse de "quelques phrases" (consigne du prompt système) n'a plus à
"payer" un raisonnement de plusieurs centaines de tokens avant le
premier mot visible, et un budget par appel plus bas laisse davantage
de marge dans le quota partagé de 1000 OTPM/minute pour enchaîner
plusieurs questions sans 429.

**Aucune garantie que ça fonctionne mieux** — `/no_think` est un
mécanisme documenté pour Qwen3.x en général, pas spécifiquement
vérifié sur le déploiement Groq de `qwen/qwen3.6-27b`. Le diagnostic
(`finishReason`/`usage` loggués dès qu'une réponse revient vide) reste
en place : si ça échoue encore, le prochain log dira immédiatement si
`/no_think` a réduit `completionTokens` ou non.

Backend typecheck/build passent. Non testé.

### Retour immédiat : "/no_think" sans effet, retour à reasoningEffort (2026-09-03, 4e round)

Log confirmant l'échec de `/no_think` : `completionTokens: 550` (=
`maxTokens` exactement), `finishReason: "length"` — identique au cas
sans aucune mitigation. Ce déploiement Groq de `qwen/qwen3.6-27b`
ignore ce "soft switch" du chat template Qwen3.x standard.

Bilan des 3 approches essayées pour empêcher le raisonnement caché de
manger tout le budget de tokens :
1. `reasoningFormat: "hidden"` seul → masque sans empêcher, ne règle
   rien.
2. `reasoningEffort: "none"` → a produit une vraie réponse correcte au
   premier essai ; un appel suivant a été rejeté (429, estimation
   "Requested" gonflée de façon imprévisible).
3. `"/no_think"` en texte dans le prompt → aucun effet mesuré.

**Retour à l'option 2** — c'est la seule des trois qui a réellement
fonctionné au moins une fois. Son défaut connu (rejet 429 possible sur
un contexte volumineux) est un compromis assumé : il se manifeste par
un message clair et actionnable ("Limite de requêtes Groq atteinte —
réessaie dans quelques secondes", déjà géré par la route), jamais une
bulle vide silencieuse. `maxTokens` fixé à 500 (le raisonnement étant
cette fois réellement désactivé, une réponse de quelques phrases ne
devrait plus avoir à en payer le coût invisible).

**Si ça échoue encore avec ce réglage** : la piste suivante ne serait
plus de retoucher ces paramètres (3 tentatives déjà), mais de
reconsidérer le choix même d'un modèle "thinking" pour Ask NAVI — un
modèle Groq non-reasoning (ex. `llama-3.3-70b-versatile` si encore
actif, `openai/gpt-oss-20b`...) n'a par construction aucun raisonnement
caché à masquer/désactiver, éliminant structurellement cette classe de
problème. Changerait le modèle demandé initialement (Qwen) — à ne
faire qu'après validation explicite, pas à la place de ce correctif.

Backend typecheck/build passent. Non re-testé.

## H6 — historique en vrais fils de conversation + questions suggérées (2026-09-03)

Demande explicite, purement frontend :

- **Historique** — `frontend/src/pages/AskNavi.tsx` : les 4 entrées du
  mock-up (`conversationHistory`, supprimée de `mock/ask-navi.ts`)
  retirées ; l'historique n'affiche plus que les vraies conversations
  posées dans la session. Passé d'un état plat (`ConversationEntry[]`)
  à un état à deux niveaux (`Conversation[]`, chacune portant ses
  propres `entries`) : une conversation = un fil, créé au premier
  message envoyé (jamais à l'ouverture de "Nouvelle conversation" —
  évite les fils vides dans l'historique), titré avec cette première
  question. Cliquer une entrée d'historique (`setActiveConversationId`)
  réaffiche tout le fil et permet d'y répondre à la suite — la mémoire
  conversationnelle (derniers échanges envoyés au LLM) reste scopée au
  fil actif, pas mélangée entre conversations.
- **5 visibles, "Voir tout"** — bouton affiché seulement s'il y a plus
  de 5 conversations ; bascule vers la liste complète (`showAllHistory`),
  avec un "Voir moins" pour revenir. Tri par activité la plus récente
  (`updatedAt`, horodatage interne — jamais affiché, distinct du
  libellé relatif "À l'instant" montré à l'utilisateur, cohérent avec
  le reste de l'app qui n'invente jamais d'horodatage précis).
- **Questions suggérées** — `moreSuggestedQuestions` (mock) remplacé par
  les 4 demandées : potentiel OTA→direct, CA CRM d'un portefeuille, taux
  de captation d'un hôtel, opportunités. Les deux dernières contiennent
  volontairement "portefeuille X"/"hôtel X" tels quels (aucun nom réel
  choisi à la place de l'utilisateur) — cliquer remplit le champ, à
  l'utilisateur de remplacer "X" par un nom exact avant d'envoyer.

**Non fait, volontairement** : aucune persistance (localStorage ou
backend) de l'historique — comme avant ce changement, tout disparaît à
un rechargement de page. Pas demandé ; à ajouter si besoin plus tard.

Frontend typecheck/build passent. Non testé dans le navigateur.

## H7 — sauvegarde de l'historique en base + suppression de conversations (2026-09-04)

Demande explicite juste après H6 : "je veux qu'on ajoute une sauvegarde
de l'historique" + "la possibilité de supprimer des conversations".
Choix d'une vraie persistance PostgreSQL plutôt que du `localStorage` —
cohérent avec le reste de NAVI (rien d'important n'est stocké
uniquement côté navigateur) et permet à l'historique de suivre
l'utilisateur d'un Codespace à l'autre, pas seulement du navigateur.

**Schéma** (migration `20260904090000_add_ask_navi_conversations`) :
- `AskNaviConversation` (id, userId, title, createdAt, updatedAt) —
  `onDelete: Cascade` depuis `User`.
- `AskNaviMessage` (id, conversationId, question, answer, sources JSON,
  createdAt) — `onDelete: Cascade` depuis `AskNaviConversation`. **Seuls
  les échanges réussis sont persistés** : pas de statut "pending"/"error"
  en base, un échec est retentable, pas un historique à conserver.

**Route `POST /api/ask-navi` modifiée** : accepte `conversationId`
(optionnel) au lieu de `history` (Phase H5, retiré) — le backend
récupère lui-même les derniers messages de la conversation en base pour
la mémoire conversationnelle (`MAX_HISTORY_TURNS`, maintenant exporté
depuis `answer-question.ts`, réutilisé ici) plutôt que de faire
confiance à ce que le frontend renvoie. Sur une réponse réussie :
crée la conversation si `conversationId` est absent (titre = première
question, tronquée à 200 caractères) ou touche son `updatedAt` sinon,
persiste le message, renvoie `conversationId` en plus de la réponse.
Sur un échec (429/502) : rien n'est créé ni persisté, comme avant.

**Nouvelles routes `backend/src/api/routes/ask-navi-conversations.ts`** :
- `GET /api/ask-navi/conversations` — toutes les conversations de
  l'utilisateur courant, messages inclus (pas de pagination : le volume
  attendu par utilisateur reste modeste pour l'instant).
- `DELETE /api/ask-navi/conversations/:conversationId` — vérifie la
  propriété (404 sinon, jamais un 403 qui confirmerait l'existence
  d'une conversation d'un autre utilisateur), cascade sur ses messages.

**Frontend `AskNavi.tsx`** — refonte du modèle de données : React Query
(`["ask-navi-conversations"]`) devient la source de vérité pour les
messages déjà persistés ; au plus UN message local éphémère
(`pendingEntry`, jamais persisté tant qu'il n'a pas réussi) représente
la question en cours ou son échec. Sur succès : invalide la query,
efface `pendingEntry`. Subtilité gérée explicitement : si l'utilisateur
change de fil PENDANT qu'une question est en cours ailleurs, la vue ne
doit pas "sauter" vers la conversation qui vient de répondre — une ref
(`activeConversationIdRef`) évite de comparer contre un state React
potentiellement périmé dans le callback de la mutation. Suppression :
bouton "corbeille" par ligne d'historique (visible au survol),
confirmation `window.confirm()` (même formulation que la suppression
d'hôtel dans Paramètres), invalide la query et réinitialise le fil
actif si c'était celui affiché.

Backend et frontend typecheck/build passent. **Migration à appliquer**
(`pnpm prisma:migrate`) avant de tester — voir instructions de refresh.
Non testé contre de vraies données.
