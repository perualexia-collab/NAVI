-- Phase F1 — trace la création réelle (non temporaire) d'une liste dans
-- Expérience pour une recommandation, une fois l'audience calculée (E2)
-- ou choisie (E3) — cf. backend/scans/run-create-audience-list.ts.
ALTER TABLE "Recommendation" ADD COLUMN "exportedListName" TEXT;
ALTER TABLE "Recommendation" ADD COLUMN "exportedAt" TIMESTAMP(3);
