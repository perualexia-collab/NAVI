import { prisma } from "../../db/prisma.js";

export interface LatestHotelScan {
  scanHotelId: string;
  status: string;
  healthScore: number | null;
  healthLevel: string | null;
  startedAt: Date | null;
  alerts: number;
  vigilances: number;
  opportunities: number;
}

/**
 * Dernier scan connu par hôtel (statut, santé, décompte alertes/
 * vigilances/opportunités) — utilisé par /api/portfolios, /api/dashboard
 * et /api/hotels/overview. Extrait dans un module partagé (plutôt que
 * dans l'une des routes qui l'utilisent) pour éviter un import circulaire
 * entre hotels.ts et portfolios.ts.
 */
export async function getLatestScanByHotelId(hotelIds: string[]): Promise<Map<string, LatestHotelScan>> {
  if (hotelIds.length === 0) return new Map();
  const latestScans = await prisma.scanHotel.findMany({
    where: { hotelId: { in: hotelIds } },
    orderBy: { startedAt: "desc" },
    distinct: ["hotelId"],
    select: { id: true, hotelId: true, status: true, healthScore: true, healthLevel: true, startedAt: true }
  });

  // Sévérité portée par SignalDefinition (pas SignalResult lui-même) —
  // groupBy Prisma ne peut pas grouper sur un champ d'une relation, d'où
  // le comptage en mémoire ci-dessous plutôt qu'un groupBy SQL.
  const scanHotelIds = latestScans.map((s) => s.id);
  const signals =
    scanHotelIds.length === 0
      ? []
      : await prisma.signalResult.findMany({
          where: { scanHotelId: { in: scanHotelIds } },
          select: { scanHotelId: true, signal: { select: { severity: true } } }
        });

  const countsByScanHotelId = new Map<string, { ALERT: number; VIGILANCE: number; OPPORTUNITY: number }>();
  for (const row of signals) {
    const entry = countsByScanHotelId.get(row.scanHotelId) ?? { ALERT: 0, VIGILANCE: 0, OPPORTUNITY: 0 };
    entry[row.signal.severity as "ALERT" | "VIGILANCE" | "OPPORTUNITY"]++;
    countsByScanHotelId.set(row.scanHotelId, entry);
  }

  return new Map(
    latestScans.map((s) => {
      const counts = countsByScanHotelId.get(s.id) ?? { ALERT: 0, VIGILANCE: 0, OPPORTUNITY: 0 };
      return [
        s.hotelId,
        {
          scanHotelId: s.id,
          status: s.status,
          healthScore: s.healthScore,
          healthLevel: s.healthLevel,
          startedAt: s.startedAt,
          alerts: counts.ALERT,
          vigilances: counts.VIGILANCE,
          opportunities: counts.OPPORTUNITY
        }
      ];
    })
  );
}
