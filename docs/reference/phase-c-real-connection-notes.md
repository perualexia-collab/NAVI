# Phase C — clôture réelle : notes de connexion Expérience

Document vivant — à compléter au fil des vrais essais contre Expérience
(le code n'a été porté qu'à partir du script existant, jamais exécuté
contre une session réelle par l'agent qui l'a écrit : ni identifiants, ni
accès réseau à `crm.experience-hotel.com` dans son environnement).

## Points ouverts, non tranchés — à vérifier/décider pendant le premier run réel

### 1. Identité de l'hôtel pilote : Hôtel Louis II (décidé le 2026-09-02)

L'ambiguïté d'origine (Apollinaire vs "Baudelaire Opéra", script existant
contradictoire) est devenue sans objet : l'utilisateur a choisi **Hôtel
Louis II** comme hôtel pilote pour le premier test réel.
`backend/prisma/seed-data/pilot-hotel.ts` a été mis à jour en conséquence
(`id: "pilot-louis-ii"`, `name`/`experienceLabel: "Hôtel Louis II"`).

`experienceLabel` reste une hypothèse (reprend le nom NAVI tel quel) —
**avant le premier scan réel**, vérifier le libellé exact affiché dans
Expérience pour cet hôtel et corriger `pilot-hotel.ts` si besoin
(`selectHotel()` fait une recherche en correspondance exacte).

⚠️ Ce nom coïncide avec un hôtel du jeu de données mocké
(`frontend/src/mock/data.ts`, "Hôtel Louis II" dans le portefeuille "Paris
Collection") — pure coïncidence de nom, aucun lien : ce sont deux entités
distinctes (mock vs `Hotel` réel en base), mais à garder en tête si les
deux apparaissent dans l'UI en même temps pendant les tests.

### 2. Sélecteurs du formulaire de connexion (email/mot de passe) — RÉSOLU le 2026-09-02

Confirmé contre le vrai DOM via inspection réseau (onglet Payload) : champ
identifiant = `input[name="username"]` (accepte email ou nom
d'utilisateur, pas de `type="email"`), champ mot de passe =
`input[type="password"]` (fonctionnait déjà). `fillLoginCredentials()`
corrigé en conséquence — voir table des bugs ci-dessous. Ne pas saisir le
mot de passe à la main dans noVNC (bug clavier Majuscule/Shift identifié,
voir table des bugs) : toujours passer par l'auto-remplissage
(`connect:experience`), la 2FA restant seule étape manuelle.

### 3. Scrapers jamais vérifiés contre le vrai DOM — premier run réel effectué le 2026-09-02

Premier scan réel exécuté sur l'hôtel pilote : 4 des 5 étapes ont réussi
du premier coup (CAPTURE, OTA, RETURNING, MARKETING) — les sélecteurs
portés depuis le script d'origine étaient donc globalement corrects.
Un bug réel trouvé et corrigé sur BASE (course avec le chargement
asynchrone d'Expérience, voir table des bugs). À revalider avec un
nouveau scan pour confirmer le correctif et obtenir un premier `SUCCESS`
complet.
- Textes de lignes de tableau (`"Profils avec e-mail renseigné"`, etc.)
  confirmés corrects sur ce run réel.

### 4. Correspondance KPI catalogue ↔ scrapés

`backend/scans/map-kpi-results.ts` mappe explicitement chaque valeur
scrapée vers un `kpiDefinitionId` du catalogue réel. À reconfirmer avec de
vraies valeurs que rien n'est décalé (ex. confusion entre taux Booking vs
Expedia, N vs N-1).

## Retours réels post-connexion (2026-09-02) — présentation CRM Health

Une fois le premier scan réel réussi (`PARTIAL_SUCCESS` puis un scan
complet avec score calculé, `55.82/100 "Fragile"`), plusieurs écarts de
présentation invisibles avec les données mockées sont apparus :
- Étiquette de niveau ("Fragile", "Critique"...) pas alignée sur la
  couleur de l'anneau de score → corrigé (`scoreTone` réutilisé pour les
  deux).
- Score affiché à 2 décimales → arrondi à l'unité **à l'affichage
  uniquement** (`ScoreRing`) ; la valeur stockée en base reste précise
  (pas de modification du moteur de scoring, cf. avertissement en tête de
  `crm-health.ts`).
- Parts/taux affichés sans unité → suffixe `%` ajouté par
  `kpiDefinitionId` (liste explicite en dur côté frontend, le référentiel
  Excel ne portant pas cette information).
- CA (CRM / automation / campagne) sans devise → `formatCurrency` (€).
- Libellés renommés dans le catalogue KPI : "CA par automation" → "CA
  automation", "CA par campagne ponctuelle" → "CA campagne ponctuelle".
- Comparaison N vs N-1 des KPI non filtrables (OTA, Returning Guests) :
  le moteur scrapait déjà les deux années
  (`backend/experience/scrapers/{ota,returning-guests}.ts`) mais seule la
  valeur N était persistée. Ajout de `KPIResult.previousValue` /
  `evolutionPoints` (migration `20260902130000_add_kpi_result_evolution`)
  + affichage "VS X% en {N-1}, +/- pts" coloré (vert hausse / rouge
  baisse).
- Nouvel indicateur "Taux d'activabilité" (`usableEmails / totalProfiles`,
  déjà calculé par `scrapeGeneralKPIs()` mais jamais persisté) ajouté au
  catalogue et affiché à la place de "Désinscrits" dans la grille (KPI
  toujours scrapé/persisté, juste masqué de cet affichage).
- Estimation de temps pendant un scan en cours : remplace le texte
  générique "peut prendre plusieurs minutes" par une estimation basée sur
  la durée moyenne des scans précédents pour cet hôtel
  (`averageScanDurationMs`, exposé par `GET /api/hotels/:id/health`) —
  reste générique tant qu'aucun scan précédent n'a de durée connue
  (premier scan d'un hôtel).

**Point laissé ouvert, pas tranché unilatéralement** : l'utilisateur avait
initialement demandé une logique de nouvelle tentative (3 essais) au
niveau du scan pour absorber les lenteurs de chargement d'Expérience. Le
correctif appliqué sur `readBaseSummary()` (polling ciblé jusqu'à ce que
le texte contienne de vrais chiffres) traite la cause racine constatée
pour cette étape précise, mais ne remplace pas un filet de sécurité plus
général au niveau du scan pour d'autres étapes non encore vérifiées en
réel. Pas implémenté ici — à décider avec l'utilisateur si nécessaire.

## Bugs / erreurs rencontrées pendant le premier run réel

| Date | Étape | Symptôme | Cause | Correctif |
| --- | --- | --- | --- | --- |
| 2026-09-02 | Connexion Expérience (saisie manuelle noVNC) | "Erreur, identifiants incorrects" alors que les identifiants sont corrects (vérifiés OK dans un navigateur classique) | Désynchronisation Majuscule/Shift entre le clavier local et la session X11 distante via noVNC/x11vnc — les lettres tapées en majuscule (ex. `C`, `Y`) arrivaient en minuscule dans le formulaire (confirmé via inspection du payload réseau réel : `username`/`password` envoyés). Bug du pont clavier VNC, sans rapport avec le compte. | Contourné en utilisant l'auto-remplissage Playwright (`connect:experience`), qui fixe la valeur du champ directement (pas de simulation de frappe clavier, donc insensible à ce bug). Ne pas taper le mot de passe à la main dans noVNC ; éditer `backend/.env` via l'éditeur du Codespace (clavier local, hors noVNC) si la valeur doit changer. |
| 2026-09-02 | Auto-remplissage (`fillLoginCredentials`) | Mot de passe rempli, mais champ e-mail/utilisateur laissé vide | Le champ n'est pas un vrai `<label>` associé et n'est pas `input[type="email"]` (label visuel "ADRESSE EMAIL OU NOM D'UTILISATEUR", accepte aussi un nom d'utilisateur) — confirmé via le payload réseau : `name="username"`. Les sélecteurs `getByLabel(/e-?mail/i)` / `input[type="email"]` ne matchaient donc jamais ce champ ; seul le mot de passe (`type="password"`, toujours présent) était trouvé. | `backend/experience/core/session.ts` → `fillLoginCredentials()` : ajout de `input[name="username"]` comme sélecteur prioritaire (nom de champ réel confirmé). |
| 2026-09-02 | Premier scan réel, étape "Base exploitable" | `ScanHotel` en `PARTIAL_SUCCESS` (4/5 étapes OK) — score/signaux correctement laissés `null`. Erreur BASE persistée (`ScanError.technicalMessage`) : `Error: Résumé base illisible : renseignés sur un total de undefined profils clients` (`base.ts:21`, `ELEMENT_NOT_FOUND`). | Course avec le chargement asynchrone d'Expérience : le conteneur du résumé est visible immédiatement, mais avec les valeurs affichées littéralement comme `undefined` avant que l'appel de données côté Expérience ne se termine et ne les remplace. `summary.waitFor({ state: "visible" })` ne garantit donc pas que le texte contient déjà les vrais chiffres. | `backend/experience/scrapers/base.ts` → `readBaseSummary()` : remplace l'attente de visibilité seule par une boucle de polling (jusqu'à 20 s, intervalle 300 ms) qui relit `innerText()` jusqu'à obtenir un texte qui matche effectivement le motif numérique attendu. Reste à revalider avec un nouveau scan réel (pas encore fait à l'heure de cette note). |

## Ce qui a été vérifié (hors connexion réelle)

- Orchestration complète (`run-hotel-scan.ts`) : persistance par étape,
  gate scoring/signaux sur SUCCESS uniquement, PARTIAL_SUCCESS/FAILED —
  validé avec des fixtures injectées (Phase C, `C4`), jamais avec de
  vraies données Expérience. Les fixtures ne permettent pas à elles
  seules de déclarer la Phase C terminée (garde-fou explicite).
- VNC/noVNC (Xvfb + x11vnc + websockify) : testé de bout en bout dans
  l'environnement de développement de l'agent (pas le Codespace réel) —
  installation apt, démarrage idempotent, Chromium headed rendant
  effectivement sur le display Xvfb, page noVNC servie en HTTP 200. Reste
  à confirmer dans un vrai Codespace (réseau/forwarding de ports
  potentiellement différents).
