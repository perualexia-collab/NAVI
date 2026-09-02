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

### 3. Scrapers jamais vérifiés contre le vrai DOM

`backend/experience/scrapers/{base,capture,ota,marketing,returning-guests}.ts`
sont portés à l'identique depuis le script existant. Les sélecteurs
(`getByText`, `getByRole("cell", ...)`, structure de tableau via
`xpath=ancestor::tr[1]`, etc.) n'ont été revalidés par personne depuis
cette extraction. À surveiller particulièrement :
- `readBaseSummary()` (base.ts) : regex sur un texte libre
  ("X renseignés sur un total de Y profils clients") — fragile si le
  libellé Expérience a légèrement changé.
- Textes de lignes de tableau (`"Profils avec e-mail renseigné"`, etc.)
  supposés identiques au script d'origine.

### 4. Correspondance KPI catalogue ↔ scrapés

`backend/scans/map-kpi-results.ts` mappe explicitement chaque valeur
scrapée vers un `kpiDefinitionId` du catalogue réel. À reconfirmer avec de
vraies valeurs que rien n'est décalé (ex. confusion entre taux Booking vs
Expedia, N vs N-1).

## Bugs / erreurs rencontrées pendant le premier run réel

| Date | Étape | Symptôme | Cause | Correctif |
| --- | --- | --- | --- | --- |
| 2026-09-02 | Connexion Expérience (saisie manuelle noVNC) | "Erreur, identifiants incorrects" alors que les identifiants sont corrects (vérifiés OK dans un navigateur classique) | Désynchronisation Majuscule/Shift entre le clavier local et la session X11 distante via noVNC/x11vnc — les lettres tapées en majuscule (ex. `C`, `Y`) arrivaient en minuscule dans le formulaire (confirmé via inspection du payload réseau réel : `username`/`password` envoyés). Bug du pont clavier VNC, sans rapport avec le compte. | Contourné en utilisant l'auto-remplissage Playwright (`connect:experience`), qui fixe la valeur du champ directement (pas de simulation de frappe clavier, donc insensible à ce bug). Ne pas taper le mot de passe à la main dans noVNC ; éditer `backend/.env` via l'éditeur du Codespace (clavier local, hors noVNC) si la valeur doit changer. |
| 2026-09-02 | Auto-remplissage (`fillLoginCredentials`) | Mot de passe rempli, mais champ e-mail/utilisateur laissé vide | Le champ n'est pas un vrai `<label>` associé et n'est pas `input[type="email"]` (label visuel "ADRESSE EMAIL OU NOM D'UTILISATEUR", accepte aussi un nom d'utilisateur) — confirmé via le payload réseau : `name="username"`. Les sélecteurs `getByLabel(/e-?mail/i)` / `input[type="email"]` ne matchaient donc jamais ce champ ; seul le mot de passe (`type="password"`, toujours présent) était trouvé. | `backend/experience/core/session.ts` → `fillLoginCredentials()` : ajout de `input[name="username"]` comme sélecteur prioritaire (nom de champ réel confirmé). |

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
