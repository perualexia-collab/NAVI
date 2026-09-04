import { prisma } from "../../src/db/prisma.js";
import type { PortfolioFinancialsContext, PortfolioFinancialsHotelEntry } from "./types.js";

const BUSINESS_KPI_IDS = [
  "crmRevenue",
  "crmBookings",
  "automationRevenue",
  "automationBookings",
  "campaignRevenue",
  "campaignBookings"
] as const;

/**
 * CA/réservations générés, agrégés sur tous les hôtels d'un portefeuille
 * — retour réel 2026-09-03 : "il faut qu'il soit capable de faire
 * l'addition du CA de chaque hôtel du portefeuille". L'addition est
 * faite ICI, par NAVI, jamais demandée au LLM ("NAVI décide, Qwen
 * explique", §09) — Ask NAVI reçoit déjà les totaux calculés.
 *
 * Mêmes 6 KPI business que PerformanceBusinessCard (frontend) : le total
 * "généré" = automation + campagne ponctuelle ; crmRevenue/crmBookings
 * (valeur scrapée séparément) servent de vérification, pas de calcul.
 * Un hôtel jamais scanné ou sans stats marketing disponibles est compté
 * dans `hotelsWithoutData`, jamais traité comme 0 (ne pas fausser la
 * moyenne/le total avec une absence de donnée).
 */
export async function getPortfolioFinancials(userId: string, portfolioId: string): Promise<PortfolioFinancialsContext | null> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: { hotels: { include: { hotel: { select: { id: true, name: true } } } } }
  });
  if (!portfolio || portfolio.ownerId !== userId) return null;

  const hotels: PortfolioFinancialsHotelEntry[] = [];
  let totalRevenue = 0;
  let totalBookings = 0;
  let hotelsWithData = 0;

  for (const { hotel } of portfolio.hotels) {
    const scanHotel = await prisma.scanHotel.findFirst({
      where: { hotelId: hotel.id },
      orderBy: { startedAt: "desc" },
      select: {
        kpiResults: { where: { kpiDefinitionId: { in: [...BUSINESS_KPI_IDS] } }, select: { kpiDefinitionId: true, value: true, available: true } }
      }
    });

    const valueOf = (id: (typeof BUSINESS_KPI_IDS)[number]): number | null => {
      const row = scanHotel?.kpiResults.find((r) => r.kpiDefinitionId === id);
      return row?.available ? row.value : null;
    };

    const automationRevenue = valueOf("automationRevenue");
    const campaignRevenue = valueOf("campaignRevenue");
    const automationBookings = valueOf("automationBookings");
    const campaignBookings = valueOf("campaignBookings");
    const hasData = automationRevenue !== null && campaignRevenue !== null && automationBookings !== null && campaignBookings !== null;

    if (hasData) {
      totalRevenue += automationRevenue + campaignRevenue;
      totalBookings += automationBookings + campaignBookings;
      hotelsWithData++;
    }

    hotels.push({
      hotelId: hotel.id,
      hotelName: hotel.name,
      hasData,
      crmRevenue: valueOf("crmRevenue"),
      crmBookings: valueOf("crmBookings"),
      automationRevenue,
      automationBookings,
      campaignRevenue,
      campaignBookings
    });
  }

  return {
    portfolioId: portfolio.id,
    portfolioName: portfolio.name,
    hotels,
    totals: {
      totalRevenue,
      totalBookings,
      hotelsWithData,
      hotelsWithoutData: hotels.length - hotelsWithData
    }
  };
}
