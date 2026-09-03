-- Phase F6 — "Supprimer" un hôtel doit le faire disparaître réellement
-- (scans, résultats/comparaisons d'audience inclus), pas le désactiver.
-- Remplace ON DELETE RESTRICT par ON DELETE CASCADE sur les 3 relations
-- directes vers Hotel qui bloquaient la suppression.
ALTER TABLE "ScanHotel" DROP CONSTRAINT "ScanHotel_hotelId_fkey";
ALTER TABLE "ScanHotel" ADD CONSTRAINT "ScanHotel_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AudienceResult" DROP CONSTRAINT "AudienceResult_hotelId_fkey";
ALTER TABLE "AudienceResult" ADD CONSTRAINT "AudienceResult_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AudienceComparison" DROP CONSTRAINT "AudienceComparison_hotelId_fkey";
ALTER TABLE "AudienceComparison" ADD CONSTRAINT "AudienceComparison_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
