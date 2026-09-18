-- Phase I1 — comparaison d'hôtels (retour réel 2026-09-18) : étoiles,
-- nombre de chambres, emplacement — récupérés depuis Expérience
-- (Administration → Établissement) ou saisis manuellement dans
-- Paramètres. Nullable : aucune valeur inventée tant que ni Expérience ni
-- une saisie manuelle ne l'a renseignée.
-- Les 3 flags *Manual portent la priorité "manuel > Expérience" : dès
-- qu'un champ est modifié à la main, son flag passe à true et
-- "Tester la connexion" ne l'écrase plus (jusqu'à ce qu'il soit revidé
-- manuellement) — comportement interne, jamais affiché dans l'UI.

ALTER TABLE "Hotel" ADD COLUMN "stars" INTEGER;
ALTER TABLE "Hotel" ADD COLUMN "roomCount" INTEGER;
ALTER TABLE "Hotel" ADD COLUMN "location" TEXT;
ALTER TABLE "Hotel" ADD COLUMN "starsManual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Hotel" ADD COLUMN "roomCountManual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Hotel" ADD COLUMN "locationManual" BOOLEAN NOT NULL DEFAULT false;
