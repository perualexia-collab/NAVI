import { prisma } from "../../src/db/prisma.js";
import { getLatestScanByHotelId } from "../../src/services/scans/latest-scan-by-hotel.js";
import type { ContextSignal, PortfolioSignalsContext } from "./types.js";

/**
 * Signaux actifs (ni Traité ni Ignoré) des hôtels d'un portefeuille,
 * groupés par hôtel — pour "qu'est-ce qui mérite mon attention sur mon
 * portefeuille Paris ?". Un portefeuille appartient à un seul utilisateur
 * (Portfolio.ownerId, comme /api/portfolios) : `userId` doit correspondre
 * au propriétaire, sinon `null` (même traitement qu'un portefeuille
 * inexistant — pas de fuite d'existence).
 */
export async function getPortfolioSignals(userId: string, portfolioId: string): Promise<PortfolioSignalsContext | null> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: { hotels: { include: { hotel: { select: { id: true, name: true } } } } }
  });
  if (!portfolio || portfolio.ownerId !== userId) return null;

  const hotelIds = portfolio.hotels.map((h) => h.hotel.id);
  const latestScanByHotelId = await getLatestScanByHotelId(hotelIds);
  const scanHotelIds = [...latestScanByHotelId.values()].map((s) => s.scanHotelId);

  const allSignals =
    scanHotelIds.length === 0
      ? []
      : await prisma.signalResult.findMany({
          where: { scanHotelId: { in: scanHotelIds } },
          include: { signal: true, scanHotel: { select: { hotelId: true } }, recommendations: true }
        });

  // Même règle "actif" que le dashboard (backend/src/api/routes/
  // dashboard.ts, retours réels 2026-09-03) — ni Traité ni Ignoré.
  const signalsByHotelId = new Map<string, ContextSignal[]>();
  for (const result of allSignals) {
    const recommendation = result.recommendations[0] ?? null;
    if (recommendation?.status === "DONE" || recommendation?.status === "DISMISSED") continue;

    const hotelId = result.scanHotel.hotelId;
    const list = signalsByHotelId.get(hotelId) ?? [];
    list.push({
      severity: result.signal.severity as ContextSignal["severity"],
      name: result.signal.name,
      trigger: result.trigger,
      recommendedAction: result.signal.recommendedAction,
      recommendationText: recommendation?.text ?? null,
      recommendationStatus: (recommendation?.status as ContextSignal["recommendationStatus"]) ?? null,
      recommendationId: recommendation?.id ?? null
    });
    signalsByHotelId.set(hotelId, list);
  }

  return {
    portfolioId: portfolio.id,
    portfolioName: portfolio.name,
    hotels: portfolio.hotels.map((h) => ({
      hotelId: h.hotel.id,
      hotelName: h.hotel.name,
      signals: signalsByHotelId.get(h.hotel.id) ?? []
    }))
  };
}
