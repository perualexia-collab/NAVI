/**
 * Formes de données renvoyées par le Context Builder (§09 Architecture
 * Proposal) — un jeu fermé de fonctions qui lisent Prisma et retournent
 * des données déjà structurées. Ask NAVI ne reçoit jamais un accès libre
 * à la base : uniquement ces objets.
 *
 * Règle stricte : jamais de `playbookId` ici (brief — "P06" ne doit
 * jamais apparaître dans un écran ou une réponse destinés à
 * l'utilisateur final ; Ask NAVI répond à l'utilisateur final, donc son
 * contexte ne doit pas pouvoir le faire fuiter).
 */

export interface ContextSignal {
  severity: "ALERT" | "VIGILANCE" | "OPPORTUNITY";
  name: string;
  trigger: string;
  recommendedAction: string;
  recommendationText: string | null;
  recommendationStatus: "OPEN" | "IN_PROGRESS" | "DONE" | "DISMISSED" | null;
  recommendationId: string | null;
}

export interface HotelHealthScoreBreakdown {
  base: number | null;
  capture: number | null;
  ota: number | null;
  loyalty: number | null;
  activation: number | null;
}

export interface HotelHealthKpi {
  label: string;
  value: number | null;
  available: boolean;
}

export interface HotelHealthContext {
  hotelId: string;
  hotelName: string;
  hasScan: boolean;
  lastScanAt: string | null;
  healthScore: number | null;
  healthLevel: string | null;
  scoreBreakdown: HotelHealthScoreBreakdown | null;
  kpis: HotelHealthKpi[];
  // Uniquement les signaux "actifs" (ni Traité ni Ignoré) — même règle
  // que le dashboard (retours réels 2026-09-03, backend/src/api/routes/
  // dashboard.ts). La fiche hôtel elle-même reste exhaustive ; ce n'est
  // pas ce que ce contexte représente.
  signals: ContextSignal[];
}

export interface ScanHistoryEntry {
  scannedAt: string;
  status: string;
  healthScore: number | null;
  healthLevel: string | null;
}

export interface ScanHistoryContext {
  hotelId: string;
  hotelName: string;
  entries: ScanHistoryEntry[];
}

export interface PortfolioHotelSignals {
  hotelId: string;
  hotelName: string;
  signals: ContextSignal[];
}

export interface PortfolioSignalsContext {
  portfolioId: string;
  portfolioName: string;
  hotels: PortfolioHotelSignals[];
}

export interface TopOpportunity {
  hotelId: string;
  hotelName: string;
  name: string;
  priority: "high" | "normal";
  recipients: number | null;
  detailLabel: string | null;
}

export interface HotelWithoutRecentScan {
  hotelId: string;
  hotelName: string;
  // null = jamais scanné du tout (distinct de "scanné il y a longtemps").
  lastScanAt: string | null;
}

export interface HotelOverviewEntry {
  hotelId: string;
  hotelName: string;
  portfolioNames: string[];
  lastScanAt: string | null;
  scanStatus: string | null;
  healthScore: number | null;
  healthLevel: string | null;
}

/** Vue d'ensemble de tous les hôtels — contexte de repli par défaut (routeIntent "org-overview"), pour qu'Ask NAVI ait toujours de vraies données sous la main plutôt qu'un contexte vide. */
export interface AllHotelsOverview {
  hotels: HotelOverviewEntry[];
}

export interface PortfolioFinancialsHotelEntry {
  hotelId: string;
  hotelName: string;
  hasData: boolean;
  // Valeur "officielle" scrapée (Statistiques Marketing) — sert de
  // vérification face à automation+campagne, même principe que
  // PerformanceBusinessCard côté frontend.
  crmRevenue: number | null;
  crmBookings: number | null;
  automationRevenue: number | null;
  automationBookings: number | null;
  campaignRevenue: number | null;
  campaignBookings: number | null;
}

export interface PortfolioFinancialsContext {
  portfolioId: string;
  portfolioName: string;
  hotels: PortfolioFinancialsHotelEntry[];
  // Sommes déjà calculées par NAVI (jamais par le LLM) sur les hôtels
  // disposant de données — "NAVI décide, Qwen explique" (§09).
  totals: {
    totalRevenue: number;
    totalBookings: number;
    hotelsWithData: number;
    hotelsWithoutData: number;
  };
}
