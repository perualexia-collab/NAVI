# Phase D — scan multi-hôtels : notes

Document vivant, même esprit que `phase-c-real-connection-notes.md`.
Découpage explicitement demandé par l'utilisateur (2026-09-02) : **D1 →
D3 → D2**, avec un point de contrôle après D1 avant de passer à D3.

## D1 — infrastructure multi-hôtels (2026-09-02)

Construit :
- **Redis + BullMQ** (`bullmq` 6.3.4, `ioredis` 6.0.0, exact-pinnés comme
  `playwright` — cf. l'incident de version en clôture de Phase C). Le
  service `redis` et les variables `REDIS_URL`/`SCAN_QUEUE_CONCURRENCY`
  existaient déjà dans `docker-compose.yml`/`.env.example` depuis la
  Phase A, jamais utilisés jusqu'ici.
- `backend/scans/run-hotel-scan.ts` : extraction d'`executeHotelScan()`
  (le cœur de l'orchestration — connexion, collecte, persistance,
  scoring) à partir de `runHotelScan()`, pour être réutilisable par le
  scan mono-hôtel (Phase C, comportement externe inchangé) et par le
  worker multi-hôtels. `maybeFinalizeParentScan()` marque le `Scan`
  parent terminé seulement quand plus aucun `ScanHotel` n'est
  PENDING/RUNNING — fonctionne pour 1 hôtel (mono) comme pour N (portefeuille).
- `backend/scans/queue.ts` : file BullMQ `hotel-scan`, un job = un hôtel
  (`scanId`, `scanHotelId`, `hotelId`, `period`, `requestedById`).
- `backend/scans/worker.ts` : Worker BullMQ, ouvre sa propre session
  Playwright par job (jamais partagée). Démarré dans le même process que
  l'API (`backend/src/index.ts`) — simplicité en devcontainer, pas un choix
  d'architecture définitif (le service `scan-worker` séparé est déjà
  esquissé, commenté, dans `docker-compose.yml`).
- `backend/scans/run-portfolio-scan.ts` : `launchPortfolioScan()` — crée
  un `Scan` (avec `portfolioId`) + un `ScanHotel` PENDING par hôtel du
  portefeuille, enqueue un job par hôtel, retourne immédiatement.
- `POST /api/portfolios/:portfolioId/scans` — retour 202 immédiat
  (`scanId`, `scanHotelIds`), les scans tournent en arrière-plan.
- Frontend (`Portfolios.tsx`) : sélecteur de période + bouton "Lancer un
  scan portefeuille" fonctionnels pour les portefeuilles réels. Pas de
  suivi temps réel (Phase D2, volontairement) — un bandeau confirme le
  lancement, l'utilisateur doit recharger pour voir les statuts se mettre
  à jour au fur et à mesure.

### Contrainte explicite : concurrence et profil Playwright partagé

`SCAN_QUEUE_CONCURRENCY` reste à **1 par défaut**. Les jobs réutilisent
le même répertoire de profil Playwright persistant
(`EXPERIENCE_PROFILE_DIR`) — deux navigateurs ouverts simultanément dessus
se bloquent mutuellement (`SingletonLock`), un problème réellement
rencontré (et documenté) pendant la clôture de la Phase C. Passer à une
concurrence > 1 sans donner d'abord un profil dédié à chaque job
recréerait ce même blocage. Pas résolu ici — hors scope de D1 tel que
cadré par l'utilisateur ; noté pour D3 ou une itération dédiée si une
vraie concurrence devient nécessaire.

### Limite héritée de la Phase C, pas nouvelle

Si `sessionProvider.open()` échoue avant même d'entrer dans le bloc
protégé, le `ScanHotel` concerné reste bloqué à `RUNNING` (jamais
finalisé). Ce n'est pas un problème introduit par D1 — le scan mono-hôtel
de la Phase C a exactement la même limite. À revoir avec la robustesse
générale en D3 ("un hôtel qui plante ne doit jamais bloquer les autres" —
actuellement vrai au niveau de la queue/BullMQ, chaque job étant isolé,
mais ce cas précis d'échec avant d'entrer dans le scan proprement dit
mériterait un filet de sécurité explicite).

### Validé par l'utilisateur le 2026-09-02

Scan réel sur un portefeuille de 6 hôtels ("test" : 55 Montparnasse,
Andréa, Arvor, Atelier Vavin, Apollinaire, Louis II) : les 6 ont terminé
avec un score et des signaux indépendants (41 à 56/100, 1 à 2 alertes
selon l'hôtel), agrégat portefeuille correct (48/100, 6 scannés/0 à
scanner/0 critique). Un faux-positif de perte de données en cours de
test (2 hôtels au lieu de 6) s'est révélé être une confusion entre deux
portefeuilles ("zeze" vs "test") — la base n'a jamais rien perdu,
vérifié par requête SQL directe.

D1 déclaré terminé. Passage à D3 (robustesse métier multi-hôtels).

## D3 — robustesse métier multi-hôtels (2026-09-02)

Audit des 6 points demandés par l'utilisateur contre ce qui existait déjà
grâce à D1 (réutilisation intégrale d'`executeHotelScan()` par
`ScanHotel`, isolation native des jobs BullMQ) :

| Exigence | État avant D3 |
| --- | --- |
| SUCCESS/PARTIAL_SUCCESS/FAILED par hôtel | ✅ déjà vrai (validation réelle 6 hôtels) |
| ScanStep/ScanError indépendants | ✅ déjà vrai (clés sur `scanHotelId`) |
| Réutiliser `handleExperienceError()` | ✅ déjà vrai |
| Un hôtel qui plante n'affecte pas les autres | ⚠️ vrai pour les autres jobs, mais un hôtel pouvait lui-même rester bloqué à `RUNNING` pour toujours |
| Agréger sans inventer / convertir en 0 | ✅ déjà vrai (`scoresAvailable` filtre les `null`, moyenne portefeuille vérifiée : (43+52+54+43+41+56)/6 = 48, conforme à l'agrégat affiché) |
| Règles de scoring/signaux Phase C préservées | ✅ inchangées, réutilisées telles quelles |

Seul point réellement manquant : `executeHotelScan()` protège déjà
l'échec de connexion/collecte (BASE) mais pas une erreur survenant
**avant** l'ouverture de la session Playwright (hôtel supprimé entre
l'enqueue et le traitement du job, `sessionProvider.open()` en échec —
ex. `SingletonLock`). Corrigé : tout le corps de la fonction est
maintenant protégé par un filet de sécurité générique
(`handleFatalScanError`), qui finalise systématiquement le `ScanHotel`
en `FAILED` avec un `ScanError` classifié, plutôt que de le laisser
indéfiniment à `RUNNING`/`PENDING`.

Limite résiduelle assumée, pas corrigée : si un crash survient **après**
que certaines étapes ont déjà réussi (ex. échec de
`computeAndPersistScoreAndSignals` après une collecte complète), le
filet de sécurité générique marquerait toutes les étapes en erreur,
écrasant les étapes déjà réussies. Scénario étroit (pas rencontré en
conditions réelles), non traité pour rester proportionné — à revisiter
si constaté.

## D2 — expérience utilisateur (2026-09-02)

- `GET /api/scans/:scanId/events` (SSE) — poll base toutes les 1,5 s côté
  serveur (pas d'abonnement aux évènements BullMQ, plus simple/robuste
  pour cette itération), fermeture automatique dès que tous les
  `ScanHotel` sont dans un état terminal.
- ETA = moyenne des durées de scan déjà observées (tous hôtels
  confondus, `ScanHotel.durationMs`) × nombre d'hôtels restants ; `null`
  s'il n'existe aucun historique — jamais affiché comme une fausse
  précision, conformément à la consigne explicite.
- Frontend (`Portfolios.tsx`) : bandeau de progression en direct
  (X/Y terminés, ETA si disponible, statut individuel par hôtel en
  pastilles colorées), remplace le message statique "actualise la
  page..." de D1. Le tableau des hôtels ne se recharge qu'une fois le
  scan terminé (évènement `done`).
- Bouton "Lancer un scan portefeuille" désactivé tant qu'un scan est en
  cours pour CE portefeuille précisément (pas les autres).

**Critère de fin de Phase D** (défini par l'utilisateur) atteint : un
portefeuille multi-hôtels se lance, chaque hôtel est traité
indépendamment, un échec n'en bloque pas d'autres, la progression et les
statuts sont visibles en direct, et CRM Health présente les résultats
consolidés disponibles une fois terminé.

## Retours post-D2 (2026-09-02)

- **Couleur anneau/badge** : `scoreTone()` utilisait des seuils (60/75)
  différents de ceux du badge de statut (dérivé de `getHealthLevel()`,
  40/60/75/90) — un score "Fragile" (40-59) affichait un anneau rouge à
  côté d'un badge jaune. Seuils alignés partout sur 40/60.

- **Préréglages de période réels** : l'utilisateur a fourni une capture
  d'écran du vrai sélecteur "Déterminer un préréglage" d'Expérience —
  `12 DERNIERS MOIS`, `L'ANNÉE DERNIÈRE`, `CETTE ANNÉE`, `CE MOIS-CI`,
  `LE MOIS DERNIER` (+ une section "Plage de date" avec dates de
  début/fin, hors scope ici — pas de période personnalisée ajoutée au
  moteur, non demandée explicitement). `PERIOD_PRESETS`
  (backend/experience/core/config.ts) étendu avec `thisYear`/
  `thisMonth`/`lastMonth` ("Cette année"/"Ce mois-ci"/"Le mois dernier"),
  "L'année dernière" volontairement exclu. `3 derniers mois`/
  `6 derniers mois` conservés par prudence bien qu'absents de cette
  capture — voir l'avertissement dans config.ts, à trancher si un scan
  réel sur ces périodes échoue.

  Nouveau composant partagé `frontend/src/components/ui/RealPeriodSelector.tsx`
  (aperçu de plage de dates mis à jour immédiatement au choix d'un
  préréglage, pas de champ "Date de création") remplace les `<select>`
  disparates sur la fiche hôtel (`RealHotelOverview.tsx`) et le
  portefeuille (`Portfolios.tsx`) — un seul composant, un seul
  comportement partout où un scan réel se lance.

- **Période analysée visible sur la fiche hôtel** : la carte "Évolution"
  (qui n'affichait qu'un texte générique "historique insuffisant" / à
  construire en Phase D/E) est remplacée par "Période analysée",
  affichant la période réellement utilisée pour le dernier scan
  (`Scan.period`, désormais exposé par `GET /api/hotels/:id/health`) —
  pour ne jamais perdre de vue sur quelle période portent les chiffres
  affichés.

- **Période personnalisée + retrait de "3/6 derniers mois"** (retours
  utilisateur, même jour) : `3 derniers mois`/`6 derniers mois` retirés
  de `PERIOD_PRESETS` (le point ouvert ci-dessus est donc tranché — s'ils
  sont un jour nécessaires, ce sera via la période personnalisée).
  `ScanPeriod` devient une union `{ mode: "preset"; value }` |
  `{ mode: "custom"; startDate; endDate }` (dates ISO). `RealPeriodSelector`
  expose désormais deux champs de date natifs (Du/Au) éditables — modifier
  l'un des deux bascule immédiatement en période personnalisée, sans bouton
  "Appliquer".

  Côté moteur, `applyPeriodWithToggle()`/`setMarketingPeriod()` partagent
  désormais `selectPeriodInPanel()`, qui délègue au clic sur un préréglage
  (inchangé, déjà validé) ou à `fillCustomDateRange()` pour le mode
  personnalisé. **Non vérifié contre le vrai DOM** — construit uniquement
  à partir de la capture d'écran du sélecteur ("Plage de date" avec deux
  champs Début/Fin affichés au format `03 SEP 2023`), sans accès direct à
  Expérience pour confirmer le mécanisme d'édition réel (saisie directe vs
  calendrier à cliquer) ni le format exact attendu. Échoue bruyamment
  (pas de fallback silencieux) si les champs ne sont pas trouvés — à
  corriger avec les vrais sélecteurs/format dès le premier test réel
  d'une période personnalisée, même méthode que pour le formulaire de
  connexion en clôture de Phase C.
