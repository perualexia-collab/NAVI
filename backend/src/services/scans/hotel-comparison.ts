import { prisma } from "../../db/prisma.js";
import type { RequestingUser } from "../hotels/hotel-access.js";

/**
 * Comparaison d'hôtels (Phase I1, retour réel 2026-09-18) — données brutes
 * du dernier scan connu de chaque hôtel du panel, pour mise en
 * perspective côté frontend. Respecte le même scope par compte que
 * getLatestScanByHotelId() (Phase G2) : seuls les scans du compte courant
 * (ou de tout le monde pour un admin) sont pris en compte — un hôtel du
 * catalogue partagé jamais scanné PAR CE COMPTE ressort avec `hasScan:
 * false`, pas avec le scan d'un autre compte.
 *
 * Fonction dédiée plutôt qu'une extension de getLatestScanByHotelId() :
 * ce dernier est utilisé par plusieurs écrans déjà stables (CRM Health,
 * Portefeuilles, Dashboard, Ask NAVI) — ne pas y toucher pour ce nouveau
 * besoin (contrainte explicite : ne pas modifier les calculs CRM Health
 * existants).
 */
export interface HotelComparisonEntry {
  hotelId: string;
  hotelName: string;
  stars: number | null;
  roomCount: number | null;
  location: string | null;
  hasScan: boolean;
  /** Scan.period tel quel ({mode:"preset",value} | {mode:"custom",startDate,endDate}) — null si hasScan est false. */
  period: unknown | null;
  healthScore: number | null;
  healthLevel: string | null;
  // Ventilation du score — voir backend/src/services/scoring/crm-health.ts.
  // otaScore/loyaltyScore dérivent de KPI non filtrables par période
  // (nonOtaRate, returningRate) : comparables entre hôtels quelle que soit
  // leur période de scan. baseScore/captureScore/activationScore dérivent
  // de KPI filtrables par période : comparables seulement entre hôtels
  // scannés sur la même période (le frontend grise ces colonnes pour les
  // hôtels dont la période diffère de l'hôtel courant plutôt que de les
  // exclure du panel).
  baseScore: number | null;
  captureScore: number | null;
  otaScore: number | null;
  loyaltyScore: number | null;
  activationScore: number | null;
}

export async function getHotelComparisonData(hotelIds: string[], user: RequestingUser): Promise<HotelComparisonEntry[]> {
  if (hotelIds.length === 0) return [];

  const hotels = await prisma.hotel.findMany({
    where: { id: { in: hotelIds } },
    select: { id: true, name: true, stars: true, roomCount: true, location: true }
  });

  const latestScans = await prisma.scanHotel.findMany({
    where: {
      hotelId: { in: hotelIds },
      status: { in: ["SUCCESS", "PARTIAL_SUCCESS"] },
      scan: user.role === "ADMIN" ? {} : { requestedById: user.id }
    },
    orderBy: { startedAt: "desc" },
    distinct: ["hotelId"],
    select: {
      hotelId: true,
      healthScore: true,
      healthLevel: true,
      baseScore: true,
      captureScore: true,
      otaScore: true,
      loyaltyScore: true,
      activationScore: true,
      scan: { select: { period: true } }
    }
  });
  const scanByHotelId = new Map(latestScans.map((s) => [s.hotelId, s]));

  return hotels.map((hotel) => {
    const scan = scanByHotelId.get(hotel.id) ?? null;
    return {
      hotelId: hotel.id,
      hotelName: hotel.name,
      stars: hotel.stars,
      roomCount: hotel.roomCount,
      location: hotel.location,
      hasScan: scan !== null,
      period: scan?.scan.period ?? null,
      healthScore: scan?.healthScore ?? null,
      healthLevel: scan?.healthLevel ?? null,
      baseScore: scan?.baseScore ?? null,
      captureScore: scan?.captureScore ?? null,
      otaScore: scan?.otaScore ?? null,
      loyaltyScore: scan?.loyaltyScore ?? null,
      activationScore: scan?.activationScore ?? null
    };
  });
}
