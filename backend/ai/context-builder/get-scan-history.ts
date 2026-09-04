import { prisma } from "../../src/db/prisma.js";
import { canAccessHotel, type RequestingUser } from "../../src/services/hotels/hotel-access.js";
import type { ScanHistoryContext } from "./types.js";

/**
 * Historique des derniers scans d'un hôtel (statut + santé), pour des
 * questions du type "comment a évolué le score de tel hôtel ?". Mêmes
 * scans que "Historique des scans" côté fiche hôtel (GET
 * /api/hotels/:hotelId/scans) — mêmes 3 statuts terminaux uniquement
 * (SUCCESS/PARTIAL_SUCCESS/FAILED), jamais un scan encore PENDING/RUNNING.
 * Phase H8 (retour réel 2026-09-04) : `null` aussi si l'hôtel
 * n'appartient pas à l'utilisateur (défense en profondeur, comme
 * getHotelHealth()).
 */
export async function getScanHistory(hotelId: string, user: RequestingUser, limit = 5): Promise<ScanHistoryContext | null> {
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  if (!hotel || !canAccessHotel(hotel, user)) return null;

  const scans = await prisma.scanHotel.findMany({
    where: { hotelId, status: { in: ["SUCCESS", "PARTIAL_SUCCESS", "FAILED"] } },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: { startedAt: true, status: true, healthScore: true, healthLevel: true }
  });

  return {
    hotelId: hotel.id,
    hotelName: hotel.name,
    entries: scans.map((scan) => ({
      scannedAt: scan.startedAt?.toISOString() ?? "",
      status: scan.status,
      healthScore: scan.healthScore,
      healthLevel: scan.healthLevel
    }))
  };
}
