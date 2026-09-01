import type { MockHotel, MockPortfolio } from "./types.js";

/**
 * Données mockées — Phase B (brief §48). Reprennent, quand ils existent,
 * les chiffres visibles dans les mockups fournis (Accueil, Mes
 * portefeuilles, CRM Health) pour rester fidèle au design validé.
 * AUCUNE de ces valeurs n'est une donnée réelle ; ne pas les confondre
 * avec le catalogue KPI seedé en base (backend/prisma/seed-data).
 */

export const portfolios: MockPortfolio[] = [
  { id: "p-paris", name: "Paris Collection", hotelCount: 18, healthScore: 78, healthDelta: 5, scannedCount: 15, toScanCount: 2, criticalCount: 1 },
  { id: "p-azur", name: "Côte d'Azur", hotelCount: 12, healthScore: 69, healthDelta: 0, scannedCount: 10, toScanCount: 1, criticalCount: 1 },
  { id: "p-resorts", name: "Resorts", hotelCount: 15, healthScore: 81, healthDelta: 8, scannedCount: 14, toScanCount: 1, criticalCount: 0 },
  { id: "p-city", name: "City Breaks", hotelCount: 8, healthScore: 55, healthDelta: -7, scannedCount: 5, toScanCount: 2, criticalCount: 1 }
];

export const hotels: MockHotel[] = [
  {
    id: "h-galileo",
    name: "Hôtel Galileo",
    city: "Paris 15",
    starRating: 4,
    portfolioId: "p-paris",
    portfolioName: "Paris Collection",
    lastScanAt: "2026-08-31T08:42:00",
    healthScore: 89,
    healthLevel: "Excellent",
    alerts: 0,
    vigilances: 1,
    opportunities: 3,
    status: "Excellent"
  },
  {
    id: "h-louis-ii",
    name: "Hôtel Louis II",
    city: "Paris 6",
    starRating: 4,
    portfolioId: "p-paris",
    portfolioName: "Paris Collection",
    lastScanAt: "2026-08-31T07:15:00",
    healthScore: 76,
    healthLevel: "Bon",
    alerts: 0,
    vigilances: 2,
    opportunities: 2,
    status: "Sain"
  },
  {
    id: "h-majestic",
    name: "Hôtel Majestic",
    city: "Paris 16",
    starRating: 4,
    portfolioId: "p-paris",
    portfolioName: "Paris Collection",
    lastScanAt: "2026-08-30T22:31:00",
    healthScore: 61,
    healthLevel: "Correct",
    alerts: 1,
    vigilances: 2,
    opportunities: 1,
    status: "À surveiller"
  },
  {
    id: "h-delavigne",
    name: "Hôtel Delavigne",
    city: "Paris 6",
    starRating: 3,
    portfolioId: "p-paris",
    portfolioName: "Paris Collection",
    lastScanAt: "2026-08-28T00:00:00",
    healthScore: 42,
    healthLevel: "Fragile",
    alerts: 2,
    vigilances: 1,
    opportunities: 1,
    status: "Critique"
  },
  {
    id: "h-excelsior",
    name: "Hôtel Excelsior Opéra",
    city: "Paris 9",
    starRating: 4,
    portfolioId: "p-paris",
    portfolioName: "Paris Collection",
    lastScanAt: null,
    healthScore: null,
    healthLevel: null,
    alerts: null,
    vigilances: null,
    opportunities: null,
    status: "Aucun scan"
  }
];

export function getPortfolio(id: string): MockPortfolio | undefined {
  return portfolios.find((p) => p.id === id);
}

export function getHotel(id: string): MockHotel | undefined {
  return hotels.find((h) => h.id === id);
}

export function hotelsByPortfolio(portfolioId: string): MockHotel[] {
  return hotels.filter((h) => h.portfolioId === portfolioId);
}

export const recentScans = [
  { hotelId: "h-galileo", hotelName: "Hôtel Galileo", scannedAt: "2026-08-31T08:42:00", healthScore: 89 },
  { hotelId: "h-louis-ii", hotelName: "Hôtel Louis II", scannedAt: "2026-08-31T07:15:00", healthScore: 76 },
  { hotelId: "h-majestic", hotelName: "Hôtel Majestic", scannedAt: "2026-08-30T22:31:00", healthScore: 61 }
];

export const homeStats = {
  portfolioCount: 4,
  hotelCount: 53,
  recentlyScannedCount: 47,
  averageHealthScore: 72,
  averageHealthDelta: 6,
  criticalAlerts: 3,
  vigilances: 7,
  opportunityCount: 12,
  potentialClients: 24680,
  signalBreakdown: { alert: 3, vigilance: 8, opportunity: 12 }
};
