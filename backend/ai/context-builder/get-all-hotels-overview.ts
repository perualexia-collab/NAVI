import { prisma } from "../../src/db/prisma.js";
import { getLatestScanByHotelId } from "../../src/services/scans/latest-scan-by-hotel.js";
import type { AllHotelsOverview } from "./types.js";

/**
 * Vue d'ensemble de tous les hôtels (portefeuille(s), dernier scan,
 * statut, santé) — contexte de repli par défaut d'Ask NAVI (retour réel
 * 2026-09-03 : "quels hôtels n'ont pas encore été testés ?" tombait sur
 * un contexte vide faute de mot-clé reconnu). Plutôt qu'un contexte
 * vide, routeIntent() utilise cette fonction dès qu'aucune intention
 * plus précise n'est identifiée — Ask NAVI a alors toujours de vraies
 * données sous la main.
 */
export async function getAllHotelsOverview(): Promise<AllHotelsOverview> {
  const hotels = await prisma.hotel.findMany({
    where: { disabled: false },
    include: { portfolios: { include: { portfolio: { select: { name: true } } } } },
    orderBy: { name: "asc" }
  });
  const latestScanByHotelId = await getLatestScanByHotelId(hotels.map((h) => h.id));

  return {
    hotels: hotels.map((hotel) => {
      const scan = latestScanByHotelId.get(hotel.id) ?? null;
      return {
        hotelId: hotel.id,
        hotelName: hotel.name,
        portfolioNames: hotel.portfolios.map((p) => p.portfolio.name),
        lastScanAt: scan?.startedAt?.toISOString() ?? null,
        scanStatus: scan?.status ?? null,
        healthScore: scan?.healthScore ?? null,
        healthLevel: scan?.healthLevel ?? null
      };
    })
  };
}
