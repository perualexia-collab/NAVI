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
