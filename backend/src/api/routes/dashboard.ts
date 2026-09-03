import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/prisma.js";
import { requireUser } from "../require-auth.js";
import { getLatestScanByHotelId } from "../../services/scans/latest-scan-by-hotel.js";

const RECENTLY_SCANNED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Phase F5 — tableau de bord (Accueil) branché sur les vraies données,
 * remplace `homeStats`/`recentScans` mockés de frontend/src/mock/data.ts.
 * Réutilise `getLatestScanByHotelId()` (déjà utilisé par /api/portfolios)
 * pour éviter de dupliquer le calcul "dernier scan connu par hôtel".
 *
 * "Prioritaire" (opportunités) : uniquement le seul vrai signal de
 * priorité qui existe déjà dans le domaine — la règle ⭐ de P11
 * (meilleur score ET ≥ 40/100, cf. calculateOpportunityScore). P06/P09
 * n'ont pas d'équivalent (option unique, pas de comparaison) : listés
 * sans "prioritaire" plutôt que d'inventer un score.
 */
export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/api/dashboard", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const [hotels, portfolioCount] = await Promise.all([
      prisma.hotel.findMany({ where: { disabled: false }, orderBy: { name: "asc" } }),
      prisma.portfolio.count({ where: { ownerId: user.id } })
    ]);
    const hotelIds = hotels.map((h) => h.id);
    const hotelNameById = new Map(hotels.map((h) => [h.id, h.name]));

    const latestScanByHotelId = await getLatestScanByHotelId(hotelIds);

    const now = Date.now();
    let recentlyScannedCount = 0;
    let criticalAlerts = 0;
    let vigilances = 0;
    let opportunityCount = 0;
    const healthScores: number[] = [];
    const recentScans: { hotelId: string; hotelName: string; scannedAt: string; healthScore: number | null }[] = [];

    for (const [hotelId, scan] of latestScanByHotelId) {
      if (scan.startedAt && now - scan.startedAt.getTime() <= RECENTLY_SCANNED_WINDOW_MS) recentlyScannedCount++;
      if (scan.healthScore !== null) healthScores.push(scan.healthScore);
      criticalAlerts += scan.alerts;
      vigilances += scan.vigilances;
      opportunityCount += scan.opportunities;
      if (scan.startedAt) {
        recentScans.push({ hotelId, hotelName: hotelNameById.get(hotelId) ?? "", scannedAt: scan.startedAt.toISOString(), healthScore: scan.healthScore });
      }
    }
    recentScans.sort((a, b) => (a.scannedAt < b.scannedAt ? 1 : -1));

    const averageHealthScore = healthScores.length > 0 ? Math.round(healthScores.reduce((sum, v) => sum + v, 0) / healthScores.length) : null;

    const scanHotelIds = [...latestScanByHotelId.values()].map((s) => s.scanHotelId);
    const allSignals =
      scanHotelIds.length === 0
        ? []
        : await prisma.signalResult.findMany({
            where: { scanHotelId: { in: scanHotelIds } },
            include: { signal: true, scanHotel: { select: { hotelId: true } }, recommendations: true }
          });
    const opportunitySignals = allSignals.filter((result) => result.signal.severity === "OPPORTUNITY");

    // "Voir les alertes"/"Voir les vigilances" (pop-up dashboard, même
    // esprit que "Voir toutes" pour les opportunités) — pas besoin du
    // même niveau de détail que les opportunités (pas de comparaison à
    // dérouler) : le texte de recommandation suffit, déjà rempli pour
    // tous les modes d'audience (NONE/SINGLE/MULTIPLE).
    function buildSignalItems(severity: "ALERT" | "VIGILANCE") {
      return allSignals
        .filter((result) => result.signal.severity === severity)
        .map((result) => ({
          hotelId: result.scanHotel.hotelId,
          hotelName: hotelNameById.get(result.scanHotel.hotelId) ?? "",
          playbookId: result.playbookId,
          name: result.signal.name,
          trigger: result.trigger,
          detailLabel: result.recommendations[0]?.text ?? null
        }));
    }
    const alertSignals = buildSignalItems("ALERT");
    const vigilanceSignals = buildSignalItems("VIGILANCE");

    const opportunities: {
      hotelId: string;
      hotelName: string;
      playbookId: string;
      name: string;
      priority: "high" | "normal";
      recipients: number | null;
      detailLabel: string | null;
    }[] = [];

    for (const result of opportunitySignals) {
      const hotelId = result.scanHotel.hotelId;
      const hotelName = hotelNameById.get(hotelId) ?? "";
      const recommendation = result.recommendations[0] ?? null;

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
          playbookId: "P11",
          name: result.signal.name,
          priority: highlighted ? "high" : "normal",
          recipients: highlighted?.recipients ?? null,
          detailLabel: highlighted ? highlighted.audienceDefinition.name : comparison ? "Comparaison sans opportunité prioritaire" : "Comparaison non lancée"
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
          playbookId: result.playbookId,
          name: result.signal.name,
          priority: "normal",
          recipients: audienceResult?.recipients ?? null,
          detailLabel: audienceResult ? null : "Audience non calculée"
        });
      }
    }

    opportunities.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1));
    const potentialClients = opportunities.reduce((sum, o) => sum + (o.recipients ?? 0), 0);

    return {
      hotelCount: hotels.length,
      portfolioCount,
      recentlyScannedCount,
      averageHealthScore,
      criticalAlerts,
      vigilances,
      opportunityCount,
      potentialClients,
      recentScans: recentScans.slice(0, 5),
      opportunities,
      alertItems: alertSignals,
      vigilanceItems: vigilanceSignals
    };
  });
}
