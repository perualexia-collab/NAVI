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

## À venir

- **E2** — signaux à option unique (P02, P03, P04, P06, P07, P09) : bouton
  "Calculer l'audience" sur la recommandation, déclenche le cycle
  créer/mesurer/supprimer d'audience (bloc 5 du moteur existant), stocke
  un `AudienceResult` unique et le lie à la `Recommendation`.
- **E3** — P11 ("Comparer les opportunités") puis P10 ("Comparer les
  audiences" — mesure des campagnes du mois avant le choix utilisateur,
  la règle ⭐ conservée).
