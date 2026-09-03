import { prisma } from "../../src/db/prisma.js";
import type { ScanHistoryContext } from "./types.js";

/**
 * Historique des derniers scans d'un hôtel (statut + santé), pour des
 * questions du type "comment a évolué le score de tel hôtel ?". Mêmes
 * scans que "Historique des scans" côté fiche hôtel (GET
 * /api/hotels/:hotelId/scans) — mêmes 3 statuts terminaux uniquement
 * (SUCCESS/PARTIAL_SUCCESS/FAILED), jamais un scan encore PENDING/RUNNING.
 */
export async function getScanHistory(hotelId: string, limit = 5): Promise<ScanHistoryContext | null> {
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  if (!hotel) return null;

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
