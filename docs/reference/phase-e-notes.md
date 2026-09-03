# Phase E — intégration du moteur métier : notes

Document vivant, même esprit que `phase-c-real-connection-notes.md` et
`phase-d-notes.md`. Découpage tel que fixé par `docs/architecture-proposal.html` :
**E1** (playbooks sans audience) → E2 (option unique, bouton "Calculer
l'audience") → E3 (P11 puis P10, options multiples).

## État de départ

La détection de signaux (`detectSignals()`, `backend/src/services/signals/detect-signals.ts`)
et le catalogue des 12 playbooks (`SignalDefinition`, seedé depuis le
référentiel Excel) existaient déjà depuis les Foundations (Phase A) — brique
« réutilisable telle quelle ». Le scan (Phase C/D) persistait déjà un
`SignalResult` par signal détecté (`playbookId` + `trigger`), et l'API
exposait déjà `recommendedAction`/`audienceMode` du `SignalDefinition`
associé. Ce qui manquait réellement : le frontend n'affichait jamais
`recommendedAction` — seulement la sévérité, le nom et le "pourquoi"
(`trigger`). Le produit s'arrêtait donc au diagnostic, jamais à la
recommandation — exactement le vide que la Phase E doit combler.

## E1 — playbooks sans audience (P01, P05, P08, P12) (2026-09-02)

Ces 4 signaux ont un `recommendedAction` autonome : un texte d'action
complet, qui ne référence aucune audience à calculer (contrairement à P02,
P03, P04, P06, P07, P09 — mode `SINGLE`, ou P10/P11 — mode `MULTIPLE`, qui
attendent tous un calcul d'audience avant que la recommandation soit
réellement exploitable — E2/E3, pas encore construits). C'est cette
distinction qui rend E1 "simple, aucune décision UX en attente" au sens de
la roadmap : rien à calculer, rien à choisir, juste à afficher.

Construit :
- `backend/scans/run-hotel-scan.ts` — `persistSignalsAndRecommendations()`
  remplace l'ancien `signalResult.createMany()`. Pour chaque signal
  détecté, crée le `SignalResult` (inchangé), puis — uniquement si
  `SignalDefinition.audienceMode === "NONE"` — matérialise une
  `Recommendation` (`text` = `recommendedAction`, `audienceDefinitionId`
  laissé `null`). Le modèle `Recommendation` existait déjà dans le schéma
  (Foundations) mais n'était utilisé nulle part avant E1.
- `GET /api/hotels/:hotelId/health` — `signalResults[].recommendationText`,
  `null` tant qu'aucune `Recommendation` n'est associée (signaux à
  audience, en attente de E2/E3).
- Frontend (`RealHotelOverview.tsx`) — la carte "Signaux détectés" affiche
  désormais un bloc "Recommandation" sous le `trigger` quand
  `recommendationText` est présent. Les signaux à audience (P02…P04, P06,
  P07, P09…P11) restent affichés tels qu'avant (sévérité + nom + trigger,
  sans action) — leur `recommendedAction` existe côté API mais resterait
  trompeur affiché seul, sans le bouton "Calculer l'audience"/"Comparer
  les audiences" qu'E2/E3 doivent apporter.

### Pourquoi persister une `Recommendation` plutôt qu'afficher `recommendedAction` directement

`recommendedAction` (sur `SignalDefinition`) est un texte-modèle, identique
pour tous les hôtels. `Recommendation` (liée à un `SignalResult` précis,
donc à un scan et un hôtel précis) est l'instance réellement montrée à cet
hôtel à ce moment — c'est elle qui portera plus tard un statut ("traitée"),
un lien vers une audience mesurée (E2/E3), etc. Construire cette
matérialisation dès E1, même quand le texte est encore statique, évite de
la refaire a posteriori et suit le modèle validé dans le schéma
(`Recommendation.text` + `audienceDefinitionId` optionnel).

### Non testé en conditions réelles

Comme pour chaque étape précédente, à valider par un scan réel déclenchant
au moins un des 4 signaux P01/P05/P08/P12 (P01 et P05 sont les plus
probables sur les hôtels déjà scannés — captation/dépendance OTA proches
des seuils observés).

## E2 — signaux à option unique (P02, P03, P04, P06, P07, P09) (2026-09-02)

Porte le cycle "Audience Builder" d'Expérience (blocs 4/8 et 5/8 du moteur
existant) : création d'une liste **temporaire** dans Expérience → filtres
spécifiques à la définition (`AUDIENCE_DEFINITIONS`) → recalcul → mode NAVI
(exclusion réservations futures/clients présents) → sauvegarde → réouverture
(pour une lecture fiable du volume) → lecture du nombre de destinataires →
**suppression** de la liste temporaire. Ne crée jamais de liste
persistante dans Expérience — un filet de sécurité supprime la liste même
en cas d'erreur en cours de cycle.

Construit :
- `backend/experience/audience-builder/` (nouveau dossier, brief §5) :
  `definitions.ts` (les 4 `AudienceDefinitionConfig` — RISK_INACTIVITY,
  OTA_CONVERTIBLE, SECOND_BOOKING, HIGH_VALUE_ONE_TIMER — et le mapping
  playbook → définition), `calendar.ts` (calendrier "flèche année
  précédente" de l'Audience Builder — **différent** du vue-datepicker du
  sélecteur de période Reporting, cf. `docs/reference/phase-d-notes.md`),
  `filters.ts` (un filtre = un builder Playwright : nombre de séjours,
  canal dernière réservation, date de départ ≥/entre, e-mail non ouvert
  depuis, montant de réservation), `mailing-lists.ts` (ouverture, liste
  temporaire, lecture du volume, suppression), `average-spend.ts` (P09 :
  dépense moyenne par réservation, seuil dynamique du filtre montant),
  `compute-audience.ts` (`computeAudiencePreview()` — orchestrateur du
  cycle complet, porté depuis `previewAudience()`).
- `backend/scans/run-audience-compute.ts` — `executeAudienceCompute()` :
  ouvre sa propre session Playwright (jamais partagée, même contrainte que
  les scans), sélectionne l'hôtel, résout la valeur dynamique P09 si
  nécessaire, exécute le cycle, persiste un `AudienceResult`
  (`hotelId`, `audienceDefinitionId`, `recipients`).
- `backend/scans/run-hotel-scan.ts` — `persistSignalsAndRecommendations()`
  étendu : pour un signal `audienceMode: SINGLE`, matérialise désormais
  aussi une `Recommendation` (texte + `audienceDefinitionId` résolu via le
  mapping playbook → définition), en plus des signaux `NONE` déjà couverts
  par E1. `recipients` reste inconnu tant que l'utilisateur n'a pas cliqué
  "Calculer l'audience" — la recommandation existe et son texte est
  affichable dès le scan, l'audience mesurée vient ensuite.
- `POST /api/hotels/:hotelId/recommendations/:recommendationId/compute-audience`
  — synchrone dans la requête HTTP, comme le scan mono-hôtel (§C) : un seul
  hôtel, un seul calcul, pas de besoin de fan-out via la file BullMQ
  (réservée aux scans de portefeuille, D1). `GET /api/hotels/:hotelId/health`
  expose, par signal, `recommendationId`/`audienceDefinitionId` et la
  dernière mesure connue (`audienceResult: { recipients, measuredAt } | null`
  — `distinct` + `orderBy` sur `AudienceResult`, même mécanique que "dernier
  scan par hôtel").
- Frontend (`RealHotelOverview.tsx`) — sous le texte de recommandation,
  bouton "Calculer l'audience" tant qu'aucune mesure n'existe, remplacé par
  le nombre de destinataires (avec date de mesure) une fois calculé. Un
  seul calcul à la fois (contrainte serveur), les autres boutons se
  désactivent pendant qu'un calcul est en cours ; erreur affichée sous le
  bouton concerné uniquement.

### Fidélité au moteur existant

Port volontairement très proche du script d'origine (sélecteurs, temps
d'attente, ordre des étapes identiques) — seul le nom de
`getNaviRecipientsCount()` a changé (`readAudienceRecipientCount()`, pour
suivre le vocabulaire générique du brief §5). Le paramètre `channels` de
`addLastStayChannelFilter` (présent dans `AUDIENCE_DEFINITIONS.OTA_CONVERTIBLE`)
n'est en réalité pas utilisé par le script d'origine — Expérience est
interrogée directement pour découvrir les libellés Booking/Expedia
réellement disponibles pour l'hôtel (ils varient d'un hôtel à l'autre) —
comportement conservé tel quel, pas un oubli.

### Premier test réel (Belinda Hôtel & Spa, P09) et correction du calendrier

Premier essai en échec : `Header "Mois Année" du calendrier introuvable.`
dans `selectDateWithCalendar` (`addLastStayAfterFilter`/`addLastStayBetweenFilter`,
donc tout filtre "Date de départ"). Cause : le calendrier de l'Audience
Builder porté depuis le script d'origine (`docs/reference/moteur-experience-existant.js`,
mécanique "flèche `<` pour reculer d'une année, clic sur texte exact mois
puis jour") correspondait à une version antérieure d'Expérience — plus
celle en production.

DOM réel fourni par l'utilisateur (Belinda Hôtel & Spa, filtre "Date de
départ") : c'est en fait le **même composant vue-datepicker** que le
sélecteur de période Reporting déjà corrigé en Phase D
(`docs/reference/phase-d-notes.md`) — `.vdp-datepicker`, input en lecture
seule, 3 vues empilées (jour/mois/année) navigables uniquement au clic sur
les liens d'en-tête `.up`. Seule différence avec Reporting : pas de classe
`.date-start`/`.date-end` sur le conteneur (un seul champ affiché à la
fois, ou deux instances indépendantes pour "Between") — le conteneur est
donc retrouvé en remontant depuis l'input via XPath plutôt que par classe.
`backend/experience/audience-builder/calendar.ts` réécrit avec la même
mécanique que `setVdpDate()` (`backend/experience/core/navigation.ts`) :
remontée jusqu'à la vue année (boucle bornée à 2, `.up`) → clic année
exacte → clic mois (nom complet français) → clic jour exact. Ne gère pas
la pagination de décennie (fenêtre "2020 - 2029" affichée) — hors scope
tant qu'aucun filtre ne demande une date plus ancienne que 2020.

Re-test : le calendrier fonctionne (plus d'erreur "Header 'Mois Année'"),
le cycle avance jusqu'à `readAudienceRecipientCount()` — nouvel échec,
différent : `locator.evaluate: ReferenceError: __name is not defined`.
Pas un problème de sélecteur — `extractNumericHeadingFromAnchor()`
définissait une fonction nommée (`parseHeadingNumber`) **à l'intérieur**
du callback `.evaluate()`. Playwright sérialise ce callback (son
`toString()`) et le réévalue tel quel dans le contexte navigateur, qui ne
connaît pas l'aide `__name` que `tsx`/esbuild injecte côté Node pour les
fonctions nommées — d'où l'erreur, uniquement en conditions réelles
(jamais en `typecheck`/`build`, qui ne détectent rien ici). Les scrapers
KPI déjà en prod (`backend/experience/scrapers/capture.ts`,
`marketing.ts`) évitent ce piège en n'utilisant jamais de fonction nommée
imbriquée dans un `.evaluate()` — `extractNumericHeadingFromAnchor()`
corrigée pour suivre le même style (logique inlinée, aucune fonction
nommée interne).

**Confirmé par l'utilisateur le 2026-09-02** — re-test sur Belinda Hôtel &
Spa (P09, HIGH_VALUE_ONE_TIMER) et East Paris Suite (P07, SECOND_BOOKING) :
le nombre de destinataires s'affiche correctement dans les deux cas. Le
cycle complet fonctionne de bout en bout (calendrier vdp-datepicker +
lecture du volume) — E2 déclaré terminé.

## E3 — P11, "Comparer les opportunités" (2026-09-03)

P11 seulement pour l'instant — P10 reste à construire (voir "À venir").
Conforme à l'audit de l'architecture ("P11 fait déjà exactement ça —
mesurer les 3 opportunités avant de classer — donc P11 ne change quasiment
pas") : la mesure d'une opportunité réutilise **telle quelle**
`computeAudiencePreview()` construite pour E2, appelée 3 fois de suite
(une par opportunité) plutôt que réimplémentée.

Construit :
- `backend/experience/audience-builder/p11-opportunities.ts` — les 3
  opportunités (`P11_ONETIMER`, `P11_REPEATER`, `P11_OTA` — ids alignés
  sur le catalogue `AudienceDefinition` en base, différents des ids du
  script d'origine `ONETIMER`/`REPEATER`/`OTA`), chacune avec ses filtres
  et ses poids fixes (`potentialScore`/`actionabilityScore`).
- `backend/src/services/scoring/p11-opportunity.ts` — scoring relatif
  porté à l'identique (`getVolumeScore`, `getOpportunityLevel`,
  `calculateOpportunityScore`) : fonctions pures, pas persistées en base
  (recalculées à la lecture depuis `recipients` + les poids fixes de
  l'opportunité — évite toute colonne supplémentaire sur `AudienceResult`).
- `backend/scans/run-p11-opportunity-finder.ts` — `executeP11OpportunityFinder()` :
  mesure les 3 opportunités (session Expérience unique, séquentielle),
  classe (score total desc, puis potentiel desc, puis volume desc, même
  comparateur que le script d'origine), persiste un `AudienceComparison`
  (`playbookId: "P11"`) avec ses 3 `AudienceResult` — `highlighted: true`
  uniquement sur la mieux classée ET si son score ≥ 40/100 (sinon aucune
  n'est mise en avant, comme l'original).
- `persistSignalsAndRecommendations()` (`run-hotel-scan.ts`) étendu :
  les signaux `MULTIPLE` (P10, P11) matérialisent aussi une
  `Recommendation` désormais, mais avec `audienceDefinitionId` toujours
  `null` (elle ne pointe vers aucune définition unique — le frontend
  distingue le bouton à afficher via `audienceMode` + `playbookId`, pas
  via `audienceDefinitionId`).
- `POST /api/hotels/:hotelId/recommendations/:recommendationId/compare-opportunities`
  — synchrone comme `compute-audience` (E2), refuse tout playbook autre
  que P11 explicitement (P10 pas encore construit).
- `POST /api/hotels/:hotelId/audience-comparisons/:comparisonId/choose` —
  enregistre `chosenResultId` ; n'agit sur rien d'autre (la suite du flux
  contextuel, brief §22, reste Phase F).
- `GET /api/hotels/:hotelId/health` expose, pour le signal P11, la
  dernière comparaison connue (`comparison: { id, chosenResultId,
  results: [{ id, name, recipients, highlighted, totalScore, level }] } | null`).
- Frontend (`RealHotelOverview.tsx`) — sous la recommandation P11, bouton
  "Comparer les opportunités" tant qu'aucune comparaison n'existe ;
  ensuite, les 3 options côte à côte (nom, destinataires, score/niveau,
  ⭐ sur la recommandée), un bouton "Choisir" par option (remplacé par
  "✓ Choisie" une fois le choix fait), et "Recalculer la comparaison"
  pour relancer. Les boutons P11 et le bouton "Calculer l'audience" (E2)
  se désactivent mutuellement pendant qu'un calcul tourne — une seule
  session Expérience possible à la fois côté serveur.

### Confirmé par l'utilisateur le 2026-09-03

Test réel sur un hôtel déclenchant P11 (activabilité 74,55 % ≥ 50 %,
activation CRM 7,42 ‰ < 8) : les 3 opportunités mesurées correctement
(One-timers à réactiver 2 769 destinataires — 80/100, Repeaters dormants
310 — 70/100, OTA convertibles 0 — 45/100), classement cohérent, la
mieux classée marquée ⭐ et choisie avec succès ("✓ Choisie"). Les 3
mesures consécutives dans la même session (jamais testées pour E2, qui
n'en fait qu'une) tiennent la charge sans problème — calendrier et
lecture du volume compris. E3/P11 déclaré terminé.

## E3 — P10, "Comparer les audiences" (2026-09-03)

Ferme la Phase E (E1/E2/E3 P11+P10). Le playbook explicitement signalé
comme le plus fragile du moteur existant (détection d'automations par
géométrie DOM, bibliothèque de 36 campagnes/12 mois).

### Changement de logique assumé vs le script d'origine

Le script d'origine (`runP10Playbook`) demandait le choix de campagne
**avant** toute mesure d'audience ("AUCUNE audience n'est créée avant ce
choix"). L'architecture validée pour NAVI inverse volontairement cet
ordre — texte exact de l'audit : *"le nouveau playbook P10 doit mesurer
les audiences des campagnes pertinentes du mois (...) avant de présenter
le choix à l'utilisateur — sur le modèle P11"*. NAVI mesure donc
systématiquement les 3 campagnes du mois avant d'afficher quoi que ce
soit à choisir — même modèle que P11 (mesurer d'abord, choisir ensuite
avec le volume réel sous les yeux), réutilisant le même
`AudienceComparison`/`AudienceResult`.

### Construit

- `backend/experience/audience-builder/p10-automation-status.ts` —
  `openAutomationStatusP10()` (navigation Changer d'espace → Campagnes →
  Marketing automatisé → Activation rapide), `readAutomationDistributionP10()`
  (**partie la plus fragile** : Expérience n'expose la colonne
  actif/inactif d'une automation que par sa position visuelle sur l'écran,
  pas par un attribut DOM — la classification lit la position X de chaque
  texte par rapport aux deux en-têtes de colonne), `classifyAutomationStatusP10()`
  (UNKNOWN/INACTIVE/PARTIAL/ACTIVE → action MANUAL_CHECK/ACTIVATE_AUTOMATIONS/
  FIX_AUTOMATION_CONFIGURATION/SEARCH_PUNCTUAL_CAMPAIGN). Tant que le
  statut n'est pas `ACTIVE`, NAVI s'arrête là — aucune campagne recherchée
  ni mesurée, le statut est retourné tel quel pour affichage.
- `backend/experience/audience-builder/p10-campaigns.ts` — `P10_LIBRARY`
  (36 campagnes, 3 par mois, texte du référentiel porté tel quel),
  `getP10StarRule()` (Returning Guests < 7 % → met en avant Repeaters/
  One-timers/Vient souvent dans la région-ville), `getMonthlyRecommendationsP10()`.
  `AUDIENCE_TAG_TO_DEFINITION_ID` relie chaque tag d'audience du
  référentiel (ex. "Loisirs", "Couples + Loisirs") à un id `AudienceDefinition`
  — 9 nouvelles lignes ajoutées à `backend/prisma/seed-data/audience-definitions.ts`
  (`P10_REPEATERS`, `P10_NATIONAL`, `P10_LEISURE`, `P10_COUPLES`,
  `P10_BUSINESS`, `P10_ONETIMER`, `P10_FREQUENT_DESTINATION`,
  `P10_HIGH_VALUE`, `P10_COUPLES_LEISURE`) — **nécessite un `pnpm prisma:seed`**
  après avoir tiré cette branche (upsert, sans risque pour les données
  existantes).
- `backend/experience/audience-builder/p10-filters.ts` — les 6 filtres
  propres à P10 (National/Loisirs/Couples/Business/Vient souvent/Couples+Loisirs
  — listes IN/NOT IN, OR entre deux conditions) ; Repeaters/One-timers/
  Clients à forte valeur réutilisent `addStayCountFilter`/`addStayAmountFilter`
  (`filters.ts`, déjà validés en E2/E3-P11 — mêmes champs). `selectListOperator()`/
  `selectListValue()`/`addOrCondition()` (primitives génériques de liste
  multi-valeurs et de condition OR) ajoutées à `filters.ts`, réutilisables
  au-delà de P10.
- `backend/experience/audience-builder/compute-audience.ts` — refactoré :
  `computeAudiencePreview()` prend désormais un callback `buildFilters(page)`
  plutôt qu'une définition déclarative, pour rester réutilisable par les 3
  playbooks à audience (E2, P11 : filtres déclaratifs via
  `buildAudienceDefinition()` ; P10 : filtres propres, non déclaratifs)
  sans dupliquer tout le cycle créer/mesurer/supprimer.
- `backend/scans/run-p10-comparison.ts` — `executeP10Comparison()` :
  vérifie le statut des automations, puis (si `ACTIVE`) mesure les 3
  campagnes du mois et persiste un `AudienceComparison` (`playbookId: "P10"`),
  `highlighted` = règle ⭐ directement (pas de score numérique comme P11).
- `POST /api/hotels/:hotelId/recommendations/:recommendationId/compare-audiences`
  — synchrone comme les routes E2/E3-P11. `GET /api/hotels/:hotelId/health`
  expose la dernière comparaison P10 connue ; le nom/angle/pourquoi-maintenant
  de chaque campagne est retrouvé dans la bibliothèque du **mois en
  cours** (les campagnes tournent chaque mois, contrairement aux tags
  d'audience qui sont stables) — si un résultat persisté ne correspond à
  aucune campagne du mois affiché (comparaison d'un mois précédent), NAVI
  retombe sur le seul nom du tag d'audience plutôt que d'échouer.
- Frontend — bouton "Comparer les audiences" (P10), affichage des 3
  campagnes du mois (nom, angle, destinataires, ⭐), "Choisir"/"✓ Choisie"
  (même mécanique que P11). Si les automations bloquent la recherche,
  message explicatif (pas une erreur — bandeau neutre, pas rouge) avec le
  détail des automations inattendues le cas échéant.

### Non testé en conditions réelles — risque élevé assumé

Contrairement à E1/E2/E3-P11 (validés en conditions réelles avant de
passer à la suite), P10 n'a **pas** encore été testé contre une vraie
session Expérience. Points les plus susceptibles de casser, par ordre de
probabilité :
1. `readAutomationDistributionP10()` — la classification par position X
   dépend de la mise en page réelle de l'écran "Activation rapide",
   jamais vue en vrai dans ce projet.
2. Les libellés de navigation "Marketing automatisé"/"Activation rapide"
   — supposés identiques au script d'origine, non revérifiés.
3. Les 6 nouveaux filtres (National/Loisirs/Couples/Business/Vient
   souvent/Couples+Loisirs) — mécanique de liste multi-valeurs
   (`selectListOperator`/`selectListValue`) jamais exercée dans ce projet
   avant P10.

Même méthode que d'habitude en cas d'échec : message d'erreur exact →
inspection du vrai DOM si nécessaire → correction du sélecteur en cause.
À tester sur un hôtel dont le scan a déclenché P10 (activation CRM
< 8 ‰, ET activabilité < 50 % — sinon c'est P11 qui se déclenche à la
place, cf. `detect-signals.ts`).

### Premier test réel (Hôtel Opéra Opal) et correction de l'opérateur "NotIn"

Bon signe dès le premier essai : la détection des automations a
fonctionné du premier coup (statut `ACTIVE`), et la 1ère campagne du mois
("Les vacances après les vacances", Couples) a été mesurée avec succès —
310 destinataires. Les points 1 et 2 ci-dessus (géométrie DOM, libellés
de navigation) sont donc validés.

Échec sur la 2e campagne ("Loisirs") : `Opérateur NotIn introuvable.`
dans `addLeisureAudienceFilter`, sur le champ "Raison de la visite".
DOM réel fourni par l'utilisateur : ce champ n'a **pas** d'opérateur
`NotIn` — les valeurs réelles du `<select>` sont `In` / `Contains` /
`DoesNotContain` / `StartWith` / `Defined` / `NotDefined`. Le script
d'origine supposait `NotIn` (jamais vérifié contre ce champ précis en
conditions réelles). `DoesNotContain` est l'équivalent le plus proche
d'un "n'est pas parmi ces valeurs" — mêmes valeurs sélectionnées que
pour `In` (`selectListValue()` reste inchangé). `selectListOperator()`
et les deux filtres concernés (`addLeisureAudienceFilter`,
`addCouplesLeisureFilter`) corrigés en conséquence.

Poussé, en attente de re-test — à confirmer que `DoesNotContain` produit
bien le résultat attendu (exclusion, pas une autre sémantique comme un
`OR` implicite entre les deux valeurs exclues).

### Confirmé par l'utilisateur le 2026-09-03

Re-test sur Hôtel Opéra Opal : les 3 campagnes de septembre mesurées
correctement, y compris "Prolongez un peu l'été" (Loisirs, filtre
`DoesNotContain`) — 3 761 destinataires. `DoesNotContain` produit bien
le résultat attendu, exclusion confirmée. Choix enregistré avec succès
("✓ Choisie" sur Loisirs). Polish : tag d'audience affiché entre
parenthèses après le nombre de destinataires (`👥 310 (Couples)`),
retour utilisateur pris en compte immédiatement.

**Phase E déclarée entièrement terminée** (E1, E2, E3-P11, E3-P10),
toutes validées en conditions réelles.

## Phase F1 — "Créer la liste dans Expérience" (2026-09-03, non testé)

Brief §22 pas disponible en entier dans ce projet (seule la ligne
"Brancher le flux contextuel complet du brief §22 depuis chaque
recommandation existante" de `architecture-proposal.html`). Clarification
demandée à l'utilisateur via 3 options ; choix explicite retenu : **Option
1 — "Action après le choix"**. Une fois une audience calculée (E2, mode
SINGLE) ou choisie (E3, P10/P11), un nouveau bouton "Créer la liste dans
Expérience" permet de rejouer le cycle Audience Builder **sans supprimer
la liste à la fin** — contrairement à E2/E3 qui mesurent puis suppriment
systématiquement. La liste reste utilisable telle quelle par l'équipe
marketing pour lancer une vraie campagne.

Construit :
- `Recommendation.exportedListName` / `exportedAt` (nouvelles colonnes,
  migration `20260903090000_add_recommendation_export_tracking`) — trace
  qu'une liste réelle (non temporaire) a été créée pour cette
  recommandation, et sous quel nom.
- `computeAudiencePreview()` (`compute-audience.ts`) étendu avec un
  paramètre optionnel `persistAs?: string` : si fourni, ce nom remplace le
  nom temporaire généré par `createTempName()`, et l'étape de suppression
  finale (`deleteAudience`) est sautée. E2/E3 (P10/P11) n'en fournissent
  toujours pas — comportement inchangé pour eux (mesure puis suppression
  systématique).
- `backend/scans/run-create-audience-list.ts` (nouveau) —
  `executeCreateAudienceList()`, réutilise le même cycle que E2/E3 mais
  avec `persistAs`. `buildFiltersForAudience()` : dispatcher générique qui
  route vers le bon catalogue de filtres (E2 `AUDIENCE_DEFINITIONS`, P11
  `P11_OPPORTUNITIES`, ou P10 via `AUDIENCE_TAG_TO_DEFINITION_ID` +
  `buildP10AudienceFilter`) selon l'`audienceDefinitionId` reçu — possible
  car les 3 catalogues n'ont jamais d'id en commun (`RISK_INACTIVITY…` /
  `P11_ONETIMER…` / `P10_REPEATERS…`).
- `POST /api/hotels/:hotelId/recommendations/:recommendationId/create-list`
  (`backend/src/api/routes/hotels.ts`) — résout l'`audienceDefinitionId` et
  un libellé lisible différemment selon le mode : SINGLE → celui déjà sur
  la `Recommendation` ; MULTIPLE (P10/P11) → celui du résultat choisi
  (`AudienceComparison.chosenResultId`, doit déjà exister — sinon 400,
  rien à créer tant que rien n'est choisi). `buildRealListName(label,
  hotelName)` construit un nom de liste humainement lisible (pas le nom
  technique temporaire `createTempName()`). Met à jour
  `exportedListName`/`exportedAt` sur succès.
- Frontend : bouton "Créer la liste dans Expérience" (`renderCreateListAction()`
  dans `RealHotelOverview.tsx`, factorisé — utilisé aux 3 endroits SINGLE/
  P11/P10), visible seulement une fois qu'il y a quelque chose à exporter
  (`signal.audienceResult` pour SINGLE, `comparison.chosenResultId` pour
  P10/P11). Une fois créée, affiche le nom de la liste + date, avec un
  bouton "Recréer" en cas de besoin (ex. audience recalculée entre-temps).
  Compte dans le même verrou partagé `audienceActionRunning` que les
  autres actions Playwright (une seule session Expérience à la fois).

**Décision explicite : pas de champ `month` stocké sur
`AudienceComparison`.** Pour P10, le libellé de la campagne choisie au
moment de l'export continue d'être dérivé à la volée du mois courant
(`currentMonthNameFR()` + `P10_LIBRARY`), comme pour l'affichage de la
comparaison elle-même — cohérent avec le fait que rien dans le schéma
existant ne fige le mois d'une comparaison passée.

Typecheck + build backend et frontend passent tous les deux.

### Confirmé par l'utilisateur le 2026-09-03

Test en conditions réelles réussi du premier coup : création d'une liste
définitive dans Expérience (nom via `buildRealListName`, pas de
suppression finale) validée. `saveTemporaryAudience`/
`reopenTemporaryAudience` fonctionnent identiquement avec un nom
"définitif" — aucune correction nécessaire.

**Phase F1 déclarée terminée et validée en conditions réelles.**

## Phase F2 — suivi d'action sur les recommandations sans audience (2026-09-03, à tester)

Deuxième clarification de scope demandée à l'utilisateur pour la suite de
la Phase F (toujours faute du texte complet du brief §22) : option
retenue explicitement — **"suivi d'action"**, et uniquement pour les
recommandations sans audience (P01, P05, P08, P12), pas pour celles qui
ont déjà tout le cycle E2/E3/F1 (calcul/comparaison → choix → export).

Concrètement : ces 4 signaux n'affichaient jusqu'ici qu'un texte statique
(`recommendedAction`), sans aucune trace de ce que l'équipe en a fait.
Ajout d'un statut de suivi sur la `Recommendation` elle-même :

- `RecommendationStatus` (nouvel enum Prisma) : `OPEN` (défaut) →
  `IN_PROGRESS` → `DONE`, avec `DISMISSED` comme état à part (pas une
  étape du cycle). Champ `Recommendation.status`, migration
  `20260903120000_add_recommendation_status`. Le champ existe sur toutes
  les `Recommendation` (modèle partagé avec E2/E3/F1) mais n'est affiché
  côté frontend que pour `audienceMode === "NONE"`.
- `PATCH /api/hotels/:hotelId/recommendations/:recommendationId/status` —
  écriture simple (`{ status }`), même raisonnement que `/choose` (E3) :
  pas de session Expérience impliquée, donc indépendant de
  `audienceActionRunning`.
- `GET /api/hotels/:hotelId/health` expose `recommendationStatus` par
  signal (même mapping que `recommendationText`/`exportedListName`).
- Frontend : 4 pills cliquables ("À traiter" / "En cours" / "Traité" /
  "Ignoré") sous le texte de recommandation, uniquement quand
  `signal.audienceMode === "NONE"` — le bloc conteneur
  (`signal.recommendationText && (...)`) est en réalité partagé par les
  3 modes (`recommendation.text` est toujours rempli, quel que soit le
  mode), donc le nouveau bloc est gardé explicitement par
  `audienceMode === "NONE"`, pas par la seule présence du texte.

Typecheck + build backend et frontend passent tous les deux. **Non testé
contre Expérience réel** — mais contrairement à F1, cette fonctionnalité
ne touche à aucune session Playwright (écriture DB pure), donc le risque
principal est une migration mal appliquée ou un bug d'affichage, pas un
sélecteur DOM cassé. À tester en conditions réelles avant de considérer
F2 terminée.

### Confirmé par l'utilisateur le 2026-09-03

Testé — les 4 pills fonctionnent, statut persisté correctement.
**Phase F2 déclarée terminée et validée.**

## F3/F4/F5 — historique des scans, estimation audience, dashboard réel (2026-09-03)

Trois ajouts groupés suite à une série de retours utilisateur (pas des
demandes du brief §22, des améliorations UX signalées après usage réel) :

- **F3 — historique des scans** : `GET /api/hotels/:hotelId/scans` (5
  derniers, résumé) et `GET /api/hotels/:hotelId/scans/:scanHotelId`
  (détail complet, en lecture seule — `recommendationId`/`comparison`/etc.
  toujours `null`, l'état des audiences n'a de sens qu'"au présent", pas
  rattaché à un scan précis). Frontend : modale (`Modal` gagne un mode
  `wide`), réutilise `ScanResult` tel quel pour le détail — aucun bouton
  d'action ne s'affiche puisque les champs audience sont `null`.
- **F4 — estimation de temps pour les calculs d'audience** : même
  principe que l'estimation de scan (moyenne des durées passées).
  `AudienceResult.durationMs` (migration `20260903150000_...`), capturé
  dans `computeAudiencePreview()` et persisté aux 4 points d'appel.
  `averageAudienceMeasurementDurationMs` exposé par `GET /health` ;
  multiplié par 3 côté frontend pour une comparaison (P10/P11 mesurent 3
  audiences), par 1 pour un calcul simple (E2/F1).
- **F5 — dashboard (Accueil) réel** : `GET /api/dashboard` (nouveau),
  remplace les mocks `homeStats`/`recentScans`. Réutilise
  `getLatestScanByHotelId()` (déjà utilisé par `/api/portfolios`).
  "Voir toutes" (opportunités) ouvre une pop-up ; priorité "⭐" = seul
  vrai signal de priorité du domaine (règle P11, score ≥ 40) — pas de
  score inventé pour P06/P09.

Reformulation au passage : l'affichage de l'activation CRM
("7.42 ‰ < 8", lu comme un "%" mal formaté) devient "7,42 résa. /
1 000 profils < 8" — texte uniquement, calcul inchangé, n'affecte que
les prochains scans (le texte déjà persisté ne change pas
rétroactivement).

**Tout confirmé fonctionnel par l'utilisateur.**

## Phase F6 — suppression réelle (hôtels, utilisateurs) + CRM Health réel (2026-09-03)

Nouvelle série de retours après usage réel, dont un changement de
comportement explicite sur la Phase F1 (suppression d'hôtel) :

- **Suppression d'hôtel = disparition réelle, pas désactivation.**
  Revirement assumé par rapport au choix initial (essayer une suppression
  définitive, retomber sur `disabled: true` en cas de contrainte FK) :
  l'utilisateur veut que l'hôtel supprimé disparaisse **partout, y
  compris CRM Health**, historique de scans/audiences compris. Migration
  `20260903180000_hotel_delete_cascade` : passe `ON DELETE RESTRICT` →
  `ON DELETE CASCADE` sur les 3 FK directes vers `Hotel`
  (`ScanHotel.hotelId`, `AudienceResult.hotelId`,
  `AudienceComparison.hotelId` — leurs propres enfants cascadaient déjà).
  `DELETE /api/hotels/:hotelId` simplifié en suppression inconditionnelle
  ; `/reactivate` et l'état "Désactivé" ajoutés en Phase F1 sont retirés
  (plus jamais atteints).
- **`getLatestScanByHotelId()` extrait** dans
  `backend/src/services/scans/latest-scan-by-hotel.ts` (avant : défini
  dans `portfolios.ts`, importé par `dashboard.ts`) — nécessaire pour que
  `hotels.ts` puisse aussi s'en servir sans créer un import circulaire
  `hotels.ts` ↔ `portfolios.ts` (`portfolios.ts` importe déjà
  `periodSchema` depuis `hotels.ts`).
- **`GET /api/hotels/overview`** (nouveau) — même info que
  `RealPortfolioHotel` mais tous hôtels confondus (avec ou sans
  portefeuille), plus `portfolioNames` (peut appartenir à plusieurs
  portefeuilles) et `scanStatus` (statut brut du `ScanHotel`, pas
  seulement `healthLevel` — nécessaire pour honorer le filtre "Erreur").
- **CRM Health** (`CrmHealth.tsx`) réécrit : les hôtels réels
  apparaissent désormais dans le **même tableau** que les hôtels mockés
  (`HotelsTable`), avec les mêmes filtres (Tous/À surveiller/Non
  scannés/**Erreur** — ce dernier était un stub qui renvoyait toujours
  `false`, maintenant câblé sur `scanStatus === "FAILED"`), recherche et
  période. L'ancien bloc séparé "Hôtels branchés sur des données
  réelles" est retiré.
- **Suppression d'utilisateur** (admin) — `DELETE /api/users/:id`,
  même filet de sécurité que l'ancien comportement des hôtels (suppression
  définitive tentée d'abord ; repli sur `status: DISABLED` si le compte a
  déjà créé un portefeuille ou lancé un scan — contrainte FK sur
  `Portfolio.owner`/`Scan.requestedBy`, non cascadées, volontairement :
  contrairement aux hôtels, on ne veut pas perdre l'historique
  "qui a fait quoi" en supprimant un compte). Bouton "Supprimer" ajouté à
  côté de Désactiver/Réactiver/Copier le lien dans Settings, sauf pour son
  propre compte (même garde-fou que `/disable`).
- **P11 — deux corrections de contenu** : le nom `P11_OTA` avait
  "(P11)" codé en dur dans le référentiel (`audience-definitions.ts`,
  incohérent avec `P11_ONETIMER`/`P11_REPEATER`) — retiré, nécessite un
  `pnpm prisma:seed` pour se répercuter en base. Et
  `calculateOpportunityScore()` : à 0 destinataire, le barème d'origine
  (poids fixes potentialScore/actionabilityScore) donnait quand même un
  score type 45/100 — écart volontaire (décision produit, pas un bug de
  seuil) : 0 destinataire → toujours `{ totalScore: 0, level:
  "Opportunité absente" }`.

Backend et frontend typecheck/build passent. **Non testé contre
Expérience réel ni contre une vraie base** — la cascade de suppression
en particulier mérite un test réel (créer un hôtel, le scanner au moins
une fois, le supprimer, vérifier qu'il disparaît bien de Paramètres ET
CRM Health, et qu'aucune ligne orpheline ne reste en base).

## Retours post-F6 (2026-09-03)

Quatre points signalés après un premier test de F6 en conditions réelles :

- **CRM Health, hôtels mockés retirés** — la fusion mock+réel introduite
  avec F6 était un contresens : `CrmHealth.tsx` n'affiche plus que les
  hôtels réels (`GET /hotels/overview`), plus aucun hôtel de
  démonstration.
- **Seuils Bon/Excellent resserrés** — `getHealthLevel()` (crm-health.ts) :
  75-88 = Bon (était < 90), 89-100 = Excellent. Critique/Fragile/Correct
  inchangés. N'affecte que les scans futurs (le `healthLevel` déjà
  persisté par scan passé ne change pas rétroactivement).
- **Bouton "⋮" retiré** de `HotelsTable` — n'avait jamais eu d'action
  branchée dessus, retiré plutôt que laissé comme faux affordance.
- **Ré-essai automatique par étape du scan** — retour réel sur "East
  Paris Suite" en période personnalisée : l'étape BASE échouait
  ("La taille de la base... n'ont pas pu être récupérées"), mais
  fonctionnait après un peu d'attente manuelle. Cause probable :
  `applyPeriodWithToggle()` a un délai fixe (1800ms) après validation
  de la période, insuffisant si Expérience met plus longtemps à
  recalculer ses statistiques sur une période personnalisée — la
  première lecture tombe alors sur une page pas encore à jour.
  `collect-hotel-kpis.ts` : `runStep()` rejoue maintenant l'étape en
  entier (navigation + période + lecture, pas juste la lecture) une
  seconde fois après 3s si la première tentative échoue, pour chacune
  des 5 étapes.

  **Toujours en échec après ce correctif** — retour utilisateur précis
  cette fois (observation visuelle directe dans Expérience) : au
  changement de période, les valeurs affichent d'abord "N/A", puis la
  vraie donnée apparaît 2-3s après (chargement asynchrone dans
  Expérience). Le retry en entier reproduisait la même course
  (`applyPeriodWithToggle` relance le chargement, donc "N/A" réapparaît
  et le souci se represente à l'identique) plutôt que de la corriger.

  Cause racine identifiée : `readTableRow()` (`scrapers/base.ts`,
  utilisée pour les 4 lignes du tableau "E-mails renseignés") attendait
  seulement que le **libellé** (statique, présent dès le chargement de
  la page) soit visible, puis lisait le texte de la ligne immédiatement
  — aucune attente sur la **valeur** (chargée en asynchrone). Contraste
  avec `readBaseSummary()` juste au-dessus, qui avait déjà ce garde-fou
  (boucle jusqu'à 20s, revérifiée toutes les 300ms, tant que le texte ne
  matche pas un vrai nombre) suite à un retour similaire du 2026-09-02.
  `readTableRow()` fait maintenant la même chose : reboucle (jusqu'à
  20s, 300ms d'intervalle) tant que le texte de la ligne contient encore
  "N/A"/"NA". Le retry au niveau de l'étape (ci-dessus) est conservé en
  filet de sécurité pour d'autres flakiness, mais n'est plus censé être
  nécessaire pour ce cas précis — la vraie correction est cette attente
  ciblée sur la valeur elle-même.

Backend et frontend typecheck/build passent. Toujours à confirmer par
un nouveau test réel sur "East Paris Suite", période personnalisée.

### Retour immédiat : scans ralentis de ~15s (2026-09-03)

Correctif ci-dessus déployé, mais tous les scans (pas juste ceux en
période personnalisée) sont devenus plus lents (~45s → ~1min). Cause
probable : le délai de 20s dans `readTableRow()` était le même que
`readBaseSummary()`, pensé pour un vrai état de chargement transitoire —
mais si l'une des 4 lignes affiche "N/A" de façon **permanente** dans
une cellule sans rapport avec le chargement (ex. une colonne
d'évolution sans historique pour cet hôtel), la boucle attendait
inutilement jusqu'au bout des 20s à *chaque* scan, sans jamais lever
d'erreur (elle rend la main normalement au bout du délai). Délai réduit
à 5s (largement suffisant pour les 2-3s observés), bornant ce coût sans
perdre la correction. Non re-testé.
