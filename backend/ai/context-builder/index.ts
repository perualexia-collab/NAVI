/**
 * Context Builder (§09 Architecture Proposal) — le seul point d'entrée
 * aux données NAVI pour Ask NAVI. Un jeu FERMÉ de fonctions ; jamais de
 * requête Prisma libre depuis l'orchestration Ask NAVI (à construire),
 * jamais un second appel LLM pour "décider quoi chercher".
 */
export { getHotelHealth } from "./get-hotel-health.js";
export { getScanHistory } from "./get-scan-history.js";
export { getPortfolioSignals } from "./get-portfolio-signals.js";
export { getTopOpportunities } from "./get-top-opportunities.js";
export { getHotelsWithoutRecentScan } from "./get-hotels-without-recent-scan.js";
export { getAllHotelsOverview } from "./get-all-hotels-overview.js";
export { getPortfolioFinancials } from "./get-portfolio-financials.js";

export type {
  ContextSignal,
  HotelHealthContext,
  HotelHealthKpi,
  HotelHealthScoreBreakdown,
  ScanHistoryContext,
  ScanHistoryEntry,
  PortfolioSignalsContext,
  PortfolioHotelSignals,
  TopOpportunity,
  HotelWithoutRecentScan,
  HotelOverviewEntry,
  AllHotelsOverview,
  PortfolioFinancialsContext,
  PortfolioFinancialsHotelEntry
} from "./types.js";
