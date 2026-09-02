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

### Non testé en conditions réelles

Comme pour chaque étape précédente : porté fidèlement, mais pas encore
exécuté contre une vraie session Expérience. À valider sur un hôtel dont
le scan déclenche P11 (base activable ≥ 50 % et activation CRM < 8 ‰) —
observer notamment si `readAudienceRecipientCount()`/le calendrier tiennent
la charge sur 3 mesures consécutives dans la même session, chose jamais
testée pour E2 (un seul calcul à la fois).

## À venir

- **P10** — "Comparer les audiences" (mesure des campagnes du mois avant
  le choix utilisateur, règle ⭐ conservée). Explicitement signalé par
  l'architecture comme le playbook le plus fragile du moteur existant
  (détection d'automations actives/inactives par géométrie DOM,
  bibliothèque de 36 campagnes/12 mois) — mérite une passe dédiée,
  pas regroupée avec P11.
