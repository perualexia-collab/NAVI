import { prisma } from "../../src/db/prisma.js";
import { getLatestScanByHotelId } from "../../src/services/scans/latest-scan-by-hotel.js";
import type { RequestingUser } from "../../src/services/hotels/hotel-access.js";
import type { TopOpportunity } from "./types.js";

/**
 * Meilleures opportunités actives (ni Traité ni Ignoré) — pour "quelles
 * sont les meilleures opportunités en ce moment ?". Phase G2 (retour réel
 * 2026-09-04) : le catalogue d'hôtels est partagé ; seul "dernier scan"
 * (d'où proviennent ces opportunités) est scopé par compte, via `user`
 * passé à getLatestScanByHotelId().
 *
 * Reprend le même principe de priorité que le dashboard (P11 avec un
 * résultat ⭐ mis en avant = "high", tout le reste = "normal" —
 * backend/src/api/routes/dashboard.ts) mais réimplémenté ici plutôt que
 * partagé : la forme de sortie attendue par le dashboard (hotelName déjà
 * résolu par ailleurs, etc.) diffère de celle utile à Ask NAVI. À
 * fusionner si un troisième appelant apparaît.
 */
export async function getTopOpportunities(user: RequestingUser, limit = 5): Promise<TopOpportunity[]> {
  const hotels = await prisma.hotel.findMany({ where: { disabled: false }, select: { id: true, name: true } });
  const hotelNameById = new Map(hotels.map((h) => [h.id, h.name]));

  const latestScanByHotelId = await getLatestScanByHotelId(
    hotels.map((h) => h.id),
    user
  );
  const scanHotelIds = [...latestScanByHotelId.values()].map((s) => s.scanHotelId);
  if (scanHotelIds.length === 0) return [];

  const opportunitySignals = await prisma.signalResult.findMany({
    where: { scanHotelId: { in: scanHotelIds }, signal: { severity: "OPPORTUNITY" } },
    include: { signal: true, scanHotel: { select: { hotelId: true } }, recommendations: true }
  });

  const opportunities: TopOpportunity[] = [];
  for (const result of opportunitySignals) {
    const recommendation = result.recommendations[0] ?? null;
    if (recommendation?.status === "DONE" || recommendation?.status === "DISMISSED") continue;

    const hotelId = result.scanHotel.hotelId;
    const hotelName = hotelNameById.get(hotelId) ?? "";

    if (result.playbookId === "P11") {
      const comparison = await prisma.audienceComparison.findFirst({
        where: { hotelId, playbookId: "P11" },
        orderBy: { id: "desc" },
        include: { results: { include: { audienceDefinition: true } } }
      });
      const highlighted = comparison?.results.find((r) => r.highlighted) ?? null;
      opportunities.push({
        hotelId,
        hotelName,
        name: result.signal.name,
        priority: highlighted ? "high" : "normal",
        recipients: highlighted?.recipients ?? null,
        detailLabel: highlighted ? highlighted.audienceDefinition.name : null
      });
    } else {
      const audienceResult = recommendation?.audienceDefinitionId
        ? await prisma.audienceResult.findFirst({
            where: { hotelId, audienceDefinitionId: recommendation.audienceDefinitionId, comparisonId: null },
            orderBy: { measuredAt: "desc" }
          })
        : null;
      opportunities.push({
        hotelId,
        hotelName,
        name: result.signal.name,
        priority: "normal",
        recipients: audienceResult?.recipients ?? null,
        detailLabel: audienceResult ? null : "Audience non calculée"
      });
    }
  }

  opportunities.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
    return (b.recipients ?? 0) - (a.recipients ?? 0);
  });

  return opportunities.slice(0, limit);
}
