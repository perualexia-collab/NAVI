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
