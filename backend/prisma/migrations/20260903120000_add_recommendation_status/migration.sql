-- Phase F2 — suivi d'action sur les recommandations sans audience (P01,
-- P05, P08, P12) : cycle OPEN (défaut) -> IN_PROGRESS -> DONE, DISMISSED
-- à part — cf. backend/src/api/routes/hotels.ts.
CREATE TYPE "RecommendationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'DISMISSED');

ALTER TABLE "Recommendation" ADD COLUMN "status" "RecommendationStatus" NOT NULL DEFAULT 'OPEN';
