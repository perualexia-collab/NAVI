# Phase I — comparaison d'hôtels

## I1 — étoiles/chambres/emplacement + comparaison CRM Health (2026-09-18)

Retour réel suite à une démo : mettre en perspective les performances CRM
d'un hôtel avec des établissements comparables (mêmes étoiles/taille/
emplacement). Deux volets : enrichir la fiche hôtel avec des infos
contextuelles, puis un outil de comparaison dans CRM Health.

### Schéma (migration `20260918100000_add_hotel_stars_rooms_location`)

`Hotel.stars`/`roomCount`/`location` — nullables, jamais de valeur
inventée. `location` est déjà la valeur normalisée à afficher/filtrer
("Paris 6", "Lyon"), pas les champs bruts Ville/Code postal — la
dérivation a lieu au moment du scraping (voir plus bas), pas à la lecture.

`Hotel.starsManual`/`roomCountManual`/`locationManual` (booléens,
`false` par défaut) portent la règle de priorité validée avec
l'utilisateur : **on privilégie le scan Expérience, mais une modification
manuelle prime dès qu'elle existe** — sans étiquette "manuel" visible
dans l'UI (demande explicite). Concrètement : modifier un champ dans
Paramètres passe son flag à `true` (plus jamais écrasé par "Tester la
connexion" tant qu'il reste à `true`) ; vider le champ manuellement le
repasse à `false` et rend la main à Expérience au prochain test.

### Récupération Expérience (`backend/experience/`)

- `navigation.ts` → `openAdministration()`/`openEstablishmentSettings()`
  (nouveau) : espace "Administration" → lien "Établissement". Découvert
  via un script codegen fourni par l'utilisateur — jamais visité par le
  moteur avant cette phase, aucun lien avec l'espace "Reporting" existant.
- `scrapers/establishment.ts` (nouveau) → `scrapeEstablishmentInfo()` lit
  Nombre de chambres/Nombre d'étoiles/Ville/Code postal. Libellés non
  associés sémantiquement à leur `<input>` (confirmé par le script
  codegen, sélecteurs positionnels fragiles) : lecture par recherche du
  premier `<input>` suivant le texte du libellé dans l'ordre du DOM,
  même principe que les autres scrapers du projet confrontés au même
  problème (email de connexion, cartes CA de `marketing.ts`).
- `deriveLocation(city, postalCode)` (même fichier) : Expérience n'a pas
  de champ arrondissement, seulement Ville ("Paris") + Code postal
  ("75015"). Règle validée : Paris + code postal `750XX` → `"Paris
  {XX sans le zéro}"` ; toute autre ville → nom de ville tel quel, sans
  transformation.

### Branchement dans "Tester la connexion" (`run-test-connection.ts`)

Après une sélection d'hôtel réussie (donc `experienceStatus: ACTIVE`),
`enrichHotelFromEstablishmentSettings()` récupère et persiste les 3
champs — dans un `try/catch` séparé : un échec ici **ne fait jamais
échouer le test de connexion lui-même** (l'hôtel a bien été retrouvé,
c'est ce qui compte pour ce statut). `ExecuteTestConnectionResult`
expose `hotelInfoIncomplete: boolean` (vrai si étoiles/chambres/
emplacement ne sont pas tous les trois renseignés après le test, échec
compris) — l'UI Paramètres affiche une icône ⚠ discrète dans ce cas,
sans jamais empêcher le statut ACTIVE.

### Édition manuelle (Paramètres > Hôtels)

`PATCH /api/hotels/:hotelId` (nouveau) — chaque champ (étoiles/chambres/
emplacement) est optionnel et indépendant ; une valeur `null` explicite
vide le champ ET repasse son flag `xManual` à `false`. Colonne "Infos"
ajoutée au tableau existant (`hotelInfoLabel()`, format identique à CRM
Health), avec bouton crayon ouvrant une modale d'édition ; icône ⚠ sur le
badge de statut si `ACTIVE` mais infos incomplètes.

### CRM Health — affichage (`CrmHealthHotel.tsx`)

Ligne discrète sous le nom de l'hôtel (`hotelInfoLine()`) :
`★★★★ · 42 chambres · Paris 6`. Une info manquante disparaît simplement
de la ligne (pas de "—" isolé) ; la ligne entière n'apparaît pas si les
3 sont inconnues.

### Comparaison (`HotelComparisonModal.tsx` + `GET /api/hotels/comparison`)

Bouton "Comparaison" à côté de "Lancer un nouveau scan" (fiche hôtel).
Une seule modale, deux étapes :

1. **Filtres** — révisé le même jour après premier test réel : liste de
   lignes "étiquette → est → valeur" (Établissement/Étoiles/Nombre de
   chambres/Emplacement, une ligne = un critère), reliées par un
   sélecteur ET/OU entre chaque ligne, "+ Ajouter un filtre" pour en
   ajouter, icône corbeille pour en retirer — inspiré de la capture de
   référence fournie par l'utilisateur. Évaluation strictement
   séquentielle gauche-à-droite (`rowMatches` pliée avec le connecteur
   choisi à chaque étape) — pas de parenthésage ni de groupes imbriqués
   (la demande portait sur l'apparence/logique étiquette→valeur + ET/OU
   à plat, pas sur des filtres imbriqués comme "Ajouter un filtre
   imbriqué" dans la référence). Étoiles = seule valeur codée en dur (1 à
   5) ; Établissement/Emplacement alimentés par les hôtels réellement
   enregistrés ; Nombre de chambres = double champ "de/à" (pas de
   tranches fixes, évite une liste interminable si le parc a une grande
   amplitude de tailles). "Réinitialiser les filtres" remet à une seule
   ligne vide.
2. **Résultats** — tableau comparatif, hôtel courant mis en évidence,
   ligne "Moyenne du panel" (calculée sur les autres hôtels, jamais
   l'hôtel courant lui-même).

`getHotelComparisonData()` (nouveau service, backend/src/services/scans/
hotel-comparison.ts) — **volontairement distinct** de
`getLatestScanByHotelId()` (utilisé par CRM Health/Portefeuilles/
Dashboard/Ask NAVI) pour ne pas toucher aux calculs déjà stables
(contrainte explicite de l'utilisateur). Même scope par compte que
partout ailleurs (Phase G2) : un hôtel jamais scanné par le compte
courant ressort `hasScan: false`, jamais avec le scan d'un autre compte.

**Découverte pendant l'implémentation, à noter** : en creusant le moteur
de scoring (`backend/src/services/scoring/crm-health.ts`) pour trancher
quels indicateurs sont réellement comparables entre périodes différentes,
seuls 2 des 5 piliers du score sont strictement indépendants de la
période — `otaScore` (nonOtaRate) et `loyaltyScore` (returningRate),
tous deux "année N vs N-1" quelle que soit la période choisie au scan.
`baseScore`, `captureScore`, `activationScore` — et donc le
**score CRM global lui-même** — dérivent de KPI filtrables par période
(activabilité, captation, activation CRM), et ne sont donc comparables
qu'entre hôtels scannés sur la même période. C'est plus restrictif que
l'intuition initiale ("le score global est le plus sûr") validée avec
l'utilisateur avant codage — corrigé ici avec la vraie lecture du moteur
de scoring. Traduit dans l'UI par : Fidélisation/Dépendance OTA toujours
comparées ; Score CRM global/Base exploitable/Captation/Activation
grisées (et exclues de la moyenne) pour tout hôtel dont la période de
scan diffère de celle de l'hôtel courant, avec un message explicite
listant les hôtels concernés — jamais un mélange silencieux.

### Non fait, volontairement

- Pas de test réel contre une session Expérience live depuis cet
  environnement (aucun accès) — `openEstablishmentSettings()`/
  `scrapeEstablishmentInfo()` à valider avec un vrai "Tester la
  connexion" avant de les considérer fiables en production.
- Pas de comparaison des KPI bruts (CA, réservations...) au-delà des 5
  piliers de score déjà calculés — suffisant pour "mettre en
  perspective" sans surcharger la modale ; à enrichir si le besoin se
  précise après usage réel.
- Pas de distinction visuelle "valeur manuelle vs Expérience" dans
  aucune UI (demande explicite).

Backend et frontend typecheck/build passent. Migration à appliquer
(`pnpm prisma:migrate`) avant de tester.
