import { prisma } from "../../src/db/prisma.js";
import type { ContextSignal, HotelHealthContext } from "./types.js";

/**
 * Snapshot du dernier scan connu d'un hôtel — santé CRM, KPI, signaux
 * actifs. C'est la fonction de base d'Ask NAVI : "comment va tel hôtel ?",
 * "pourquoi son score est-il de X ?". Toutes les valeurs viennent
 * directement du dernier ScanHotel (moteur métier déterministe déjà
 * exécuté) — cette fonction ne recalcule jamais rien.
 *
 * `null` uniquement si l'hôtel n'existe pas. Un hôtel existant mais
 * jamais scanné renvoie un objet valide avec `hasScan: false`.
 */
export async function getHotelHealth(hotelId: string): Promise<HotelHealthContext | null> {
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  if (!hotel) return null;

  const scanHotel = await prisma.scanHotel.findFirst({
    where: { hotelId },
    orderBy: { startedAt: "desc" },
    include: {
      kpiResults: { include: { kpiDefinition: true }, orderBy: { id: "asc" } },
      signalResults: { include: { signal: true, recommendations: true } }
    }
  });

  if (!scanHotel) {
    return {
      hotelId: hotel.id,
      hotelName: hotel.name,
      hasScan: false,
      lastScanAt: null,
      healthScore: null,
      healthLevel: null,
      scoreBreakdown: null,
      kpis: [],
      signals: []
    };
  }

  // Signaux actifs uniquement (ni Traité ni Ignoré) — même règle que le
  // dashboard (backend/src/api/routes/dashboard.ts, retours réels
  // 2026-09-03) : ce contexte sert à répondre "qu'est-ce qui mérite mon
  // attention", pas à lister l'historique complet (déjà exhaustif sur la
  // fiche hôtel elle-même).
  const signals: ContextSignal[] = scanHotel.signalResults
    .filter((result) => {
      const status = result.recommendations[0]?.status;
      return status !== "DONE" && status !== "DISMISSED";
    })
    .map((result) => {
      const recommendation = result.recommendations[0] ?? null;
      return {
        severity: result.signal.severity as ContextSignal["severity"],
        name: result.signal.name,
        trigger: result.trigger,
        recommendedAction: result.signal.recommendedAction,
        recommendationText: recommendation?.text ?? null,
        recommendationStatus: (recommendation?.status as ContextSignal["recommendationStatus"]) ?? null,
        recommendationId: recommendation?.id ?? null
      };
    });

  return {
    hotelId: hotel.id,
    hotelName: hotel.name,
    hasScan: true,
    lastScanAt: scanHotel.startedAt?.toISOString() ?? null,
    healthScore: scanHotel.healthScore,
    healthLevel: scanHotel.healthLevel,
    scoreBreakdown: {
      base: scanHotel.baseScore,
      capture: scanHotel.captureScore,
      ota: scanHotel.otaScore,
      loyalty: scanHotel.loyaltyScore,
      activation: scanHotel.activationScore
    },
    kpis: scanHotel.kpiResults.map((result) => ({
      label: result.kpiDefinition.label,
      value: result.value,
      available: result.available
    })),
    signals
  };
}
