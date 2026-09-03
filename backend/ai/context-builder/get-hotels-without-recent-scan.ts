import { prisma } from "../../src/db/prisma.js";
import { getLatestScanByHotelId } from "../../src/services/scans/latest-scan-by-hotel.js";
import type { HotelWithoutRecentScan } from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Hôtels jamais scannés, ou pas scannés depuis plus de `days` jours —
 * pour "quels hôtels ai-je oublié de scanner ?". Mêmes hôtels que le
 * dashboard (disabled: false — champ aujourd'hui vestigial, jamais
 * positionné à true pour un hôtel, seulement pour un utilisateur, mais
 * conservé pour rester cohérent avec /api/dashboard).
 */
export async function getHotelsWithoutRecentScan(days = 30): Promise<HotelWithoutRecentScan[]> {
  const hotels = await prisma.hotel.findMany({ where: { disabled: false }, orderBy: { name: "asc" } });
  const latestScanByHotelId = await getLatestScanByHotelId(hotels.map((h) => h.id));

  const cutoff = Date.now() - days * DAY_MS;
  const results: HotelWithoutRecentScan[] = [];

  for (const hotel of hotels) {
    const scan = latestScanByHotelId.get(hotel.id);
    const lastScanAt = scan?.startedAt ?? null;
    if (!lastScanAt || lastScanAt.getTime() < cutoff) {
      results.push({ hotelId: hotel.id, hotelName: hotel.name, lastScanAt: lastScanAt?.toISOString() ?? null });
    }
  }

  return results;
}
