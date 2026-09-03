-- Phase F4 — durée de chaque mesure d'audience (cycle Audience Builder),
-- base de l'estimation de temps affichée pendant un calcul en cours,
-- même principe que ScanHotel.durationMs pour les scans.
ALTER TABLE "AudienceResult" ADD COLUMN "durationMs" INTEGER;
