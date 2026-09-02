-- Comparaison année N vs N-1 pour les KPI non filtrables par période (OTA,
-- Returning Guests) — le moteur scrape déjà les deux années, mais seule la
-- valeur N était persistée jusqu'ici (retours réels Phase C, 2026-09-02).
ALTER TABLE "KPIResult" ADD COLUMN "previousValue" DOUBLE PRECISION;
ALTER TABLE "KPIResult" ADD COLUMN "evolutionPoints" DOUBLE PRECISION;
