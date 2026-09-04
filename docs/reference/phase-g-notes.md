# Phase G — Hôtels propres à chaque compte

## G1 — `Hotel.ownerId` + scoping par compte (2026-09-04)

Retour réel : en testant avec un second compte NAVI (non-admin), tous
les hôtels/scans créés depuis le premier compte apparaissaient dans
CRM Health — alors que les portefeuilles étaient déjà propres à chaque
compte (`Portfolio.ownerId`). Demande explicite : "je veux que ce soit
propre à chaque compte NAVI... comme pour les portefeuilles".

**Décision validée avec l'utilisateur avant implémentation** (changement
touchant trop de fichiers pour deviner) : contrairement aux
portefeuilles (aucune exception), un **ADMIN voit et gère les hôtels de
tous les comptes** — cohérent avec la gestion des utilisateurs, déjà
org-wide pour les admins. Un utilisateur normal ne voit que les siens.

### Schéma (migration `20260904150000_add_hotel_owner`)

- `Hotel.ownerId String?` + relation vers `User`, `ON DELETE RESTRICT
  ON UPDATE CASCADE` (identique à `Portfolio.ownerId`) — un compte
  propriétaire d'hôtels ne peut pas être supprimé en dur tant qu'il en
  possède (tombe sur le fallback "désactiver" déjà en place dans
  `users.ts`, sans code spécifique à ajouter).
- **Nullable**, contrairement à `Portfolio.ownerId` — pour représenter
  honnêtement les hôtels créés avant ce champ : orphelins plutôt que
  rattachés à un propriétaire deviné au hasard dans la migration.
  Un hôtel orphelin (`ownerId: null`) n'est visible que par un admin.
- `backend/prisma/seed.ts` : le compte dev admin est maintenant créé
  AVANT l'hôtel pilote (ordre inversé) pour pouvoir le lui rattacher —
  sinon l'hôtel pilote serait resté orphelin au tout premier lancement
  d'un Codespace.

### `backend/src/services/hotels/hotel-access.ts` (nouveau)

Deux fonctions partagées, utilisées partout où un hôtel est
lu/modifié :
- `hotelOwnerFilter(user)` — fragment `where` Prisma : `{}` pour un
  admin (aucun filtre), `{ ownerId: user.id }` sinon.
- `canAccessHotel(hotel, user)` — pour un hôtel déjà chargé (souvent
  via une relation, ex. `recommendation.signalResult.scanHotel.hotelId`).

### Fichiers modifiés

- **`backend/src/api/routes/hotels.ts`** — `POST /` fixe `ownerId:
  user.id` à la création. Les 13 routes qui chargent un hôtel par id
  (`GET/DELETE/:hotelId`, `test-connection`, `health`, `scans`,
  `scans/:id`, `POST scans`, et les 6 routes `recommendations/...` /
  `audience-comparisons/.../choose`) vérifient maintenant
  `canAccessHotel()` — 404 (jamais 403, pour ne pas confirmer
  l'existence d'un hôtel d'un autre compte) si l'hôtel n'existe pas OU
  n'appartient pas à l'utilisateur (ni admin). Deux routes
  (`audience-comparisons/.../choose`, `recommendations/.../status`) ne
  chargeaient jusqu'ici AUCUN hôtel du tout — un utilisateur aurait pu
  agir sur les recommandations d'un hôtel d'un autre compte en devinant
  les identifiants ; un fetch + vérification a été ajouté.
- **`backend/src/api/routes/portfolios.ts`** — `POST /` et `PATCH /:id`
  valident maintenant que les `hotelIds` fournis sont non seulement
  existants mais accessibles à l'utilisateur (`hotelOwnerFilter`) —
  sinon un utilisateur aurait pu ajouter l'hôtel d'un autre compte dans
  son propre portefeuille en connaissant son id.
- **`backend/src/api/routes/dashboard.ts`** — la requête hôtels
  (compteurs, alertes, opportunités...) est scopée comme partout
  ailleurs.
- **Context Builder (Ask NAVI)** — `getAllHotelsOverview`,
  `getTopOpportunities`, `getHotelsWithoutRecentScan` prennent
  maintenant un `user` en paramètre et scopent leur requête hôtels.
  `getHotelHealth`/`getScanHistory` vérifient `canAccessHotel()` en
  défense en profondeur (même si `routeIntent()` ne devrait déjà
  proposer que des hôtels accessibles).
- **`backend/ai/ask-navi/route-intent.ts`** — la reconnaissance de nom
  d'hôtel dans une question ne cherche plus que parmi les hôtels
  accessibles à l'utilisateur : impossible de "faire remonter" l'hôtel
  d'un autre compte en le nommant dans une question Ask NAVI.
  `routeIntent()`/`answerQuestion()` prennent maintenant `user: {id,
  role}` plutôt qu'un simple `userId`.

### Non fait, volontairement

- Pas de UI pour qu'un admin "réassigne" un hôtel orphelin à un
  utilisateur précis — pas demandé ; un hôtel orphelin reste
  simplement visible/gérable par n'importe quel admin en l'état.
- Pas de migration de données pour deviner un propriétaire aux hôtels
  déjà en base avant ce champ — voir "Nullable" ci-dessus.

Backend et frontend typecheck/build passent. **Migration à appliquer**
(`pnpm prisma:migrate`) avant de tester. Non testé contre de vraies
données avec un second compte.

## G2 — retour au catalogue d'hôtels partagé, scans propres à chaque compte (2026-09-04)

Retour réel avec un second compte : G1 s'est révélé trop restrictif.
Demande explicite : *"je veux bien que la liste des hôtels apparaissent
quand même dans les paramètres... dès qu'un utilisateur ajoute un
hôtel, il est sur le compte de tout le monde, juste derrière sur chaque
compte il faut tester la connexion, faire le scan etc et du coup la
personne est libre de faire le scan ou pas."*

Nouveau modèle, plus fin que G1 : l'**hôtel** (nom, connexion Expérience)
redevient un **catalogue partagé** — visible et testable/scannable par
n'importe quel compte dès qu'il est ajouté. Ce qui reste propre à chaque
compte, ce sont les **scans** : "si on n'a pas fait de scan sur ce
compte-là, il n'est pas censé y en avoir" (la demande d'origine de G1,
en fait toujours vraie — seulement portée par `Scan`, pas par `Hotel`).

### Pourquoi `Scan.requestedById` plutôt que revenir en arrière sur le schéma

`Scan.requestedById` existait déjà avant G1 (qui l'utilisait pour
`runHotelScan`/`launchPortfolioScan`) — aucune nouvelle migration n'a
été nécessaire pour G2. `Hotel.ownerId` (migration
`20260904150000_add_hotel_owner`, G1) **reste en base**, mais n'est plus
utilisé pour filtrer quoi que ce soit : simple métadonnée "qui a ajouté
cet hôtel", jamais lue en dehors de `POST /api/hotels`. La retirer
aurait demandé une nouvelle migration pour rien — elle est inoffensive
laissée nullable et ignorée.

### `backend/src/services/hotels/hotel-access.ts`

`hotelOwnerFilter()`/`canAccessHotel()` (G1) **supprimées** — plus
aucun appelant. Le fichier ne garde que le type partagé
`RequestingUser`.

### `backend/src/services/scans/scan-access.ts` (nouveau)

`canAccessScan(scan, user)` — même principe que l'ancien
`canAccessHotel()`, mais sur `{ requestedById }` : `true` pour un admin
ou si `scan.requestedById === user.id`.

### `backend/src/services/scans/latest-scan-by-hotel.ts`

`getLatestScanByHotelId(hotelIds, user)` — signature étendue (G1 ne
prenait que `hotelIds`). Le `where` du `scanHotel.findMany` ajoute
`scan: { requestedById: user.id }` (rien pour un admin) : "dernier scan
connu" redevient propre au compte courant même si l'hôtel est partagé.
Tous les appelants (`hotels.ts` overview, `portfolios.ts`,
`dashboard.ts`, `getAllHotelsOverview`, `getTopOpportunities`,
`getHotelsWithoutRecentScan`) mis à jour pour passer `user`.

### Fichiers revertés vers un catalogue d'hôtels non filtré

- **`backend/src/api/routes/hotels.ts`** — `GET /`, `GET /overview`,
  `GET/DELETE/:hotelId`, `test-connection`, `POST scans` : simple
  vérification d'existence (plus de `canAccessHotel`). `POST /` garde
  `ownerId: user.id` (provenance, sans effet sur l'accès).
- **`backend/src/api/routes/portfolios.ts`** — la validation des
  `hotelIds` (POST/PATCH) redevient une simple vérification d'existence.
- **`backend/src/api/routes/dashboard.ts`**, Context Builder
  (`getAllHotelsOverview`, `getTopOpportunities`,
  `getHotelsWithoutRecentScan`), `route-intent.ts` (reconnaissance de
  nom d'hôtel dans une question) — même chose : la requête hôtels
  n'est plus filtrée.

### Fichiers où l'accès à l'hôtel reste ouvert mais où les SCANS restent scopés par compte

- **`GET /api/hotels/:hotelId/health`** — hôtel : existence seule.
  `scanCount`, `averageScanDurationMs` et `latestScan` sont filtrés par
  `scan.requestedById` (sauf admin) : deux comptes voient le même
  hôtel dans la liste, mais chacun son propre "dernier scan"/historique.
  Volontairement **laissés non scopés** (aucun lien vers
  `Scan`/`requestedById` dans le schéma, pas de migration demandée pour
  ça) : `averageAudienceMeasurementDurationMs`,
  `latestAudienceResults`, `latestP11Comparison`, `latestP10Comparison`
  — les résultats d'audience/comparaison restent partagés entre comptes
  sur un même hôtel, comme avant G1.
- **`GET /api/hotels/:hotelId/scans`** (historique) — hôtel : existence
  seule ; la liste des scans elle-même est filtrée par
  `requestedById`.
- **`GET /api/hotels/:hotelId/scans/:scanHotelId`** — hôtel : existence
  seule ; `canAccessScan(scanHotel.scan, user)` en plus de l'appartenance
  à l'hôtel (sinon 404 "Scan introuvable").
- **`compute-audience`, `compare-opportunities`, `compare-audiences`,
  `create-list`, `recommendations/.../status`** — même principe :
  `canAccessScan()` sur le scan déjà chargé via la relation
  `signalResult.scanHotel.scan` (include étendu là où il manquait
  `scan: true`), hôtel lui-même vérifié seulement par existence.
- **`audience-comparisons/.../choose`** — reverté à une vérification
  d'existence simple (ni hôtel-owner ni scan-owner) : `AudienceComparison`
  n'a pas de lien vers `Scan`/`requestedById` dans le schéma — cohérent
  avec le choix ci-dessus de laisser les résultats d'audience partagés.
- **`getHotelHealth`/`getScanHistory`** (Context Builder, Ask NAVI) —
  même bascule : hôtel accessible à tous, scan utilisé (dernier scan/
  historique) filtré par `requestedById` (sauf admin).

### Non fait, volontairement

- Pas de retrait de `Hotel.ownerId` du schéma (voir plus haut).
- Pas de scoping par compte des résultats d'audience/comparaison
  (`AudienceResult`, `AudienceComparison`) — pas de champ
  `requestedById` dessus, pas demandé explicitement ; ils restent
  partagés entre comptes sur un même hôtel (comportement d'avant G1 et
  toujours d'après G2).

### Recherche d'hôtel par nom dans CRM Health

Demande également faite dans ce retour ("une barre de recherche pour
pouvoir rechercher un hôtel par son nom") : déjà présente et
fonctionnelle dans `frontend/src/pages/CrmHealth.tsx` (champ `search`,
filtre `allHotels.filter((h) => h.name.toLowerCase().includes(...))`)
— rien à construire.

Backend et frontend typecheck/build passent. **Aucune nouvelle
migration** (réutilise `Scan.requestedById`, déjà en base) — mais la
migration G1 (`add_hotel_owner`) doit avoir été appliquée au préalable
pour que `Hotel.ownerId` existe en base (colonne désormais inerte, mais
toujours écrite par `POST /api/hotels`). Non testé contre de vraies
données avec un second compte.
