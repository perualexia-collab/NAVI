import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireUser } from "../require-auth.js";

const createPortfolioSchema = z.object({
  name: z.string().trim().min(1, "Nom du portefeuille requis."),
  hotelIds: z.array(z.string().min(1)).min(1, "Sélectionne au moins un hôtel.")
});

interface LatestHotelScan {
  status: string;
  healthScore: number | null;
}

function serializePortfolio(
  portfolio: {
    id: string;
    name: string;
    createdAt: Date;
    hotels: { hotel: { id: string; name: string; experienceLabel: string; experienceHotelId: string | null; experienceStatus: string; disabled: boolean; lastConnectionCheckAt: Date | null } }[];
  },
  latestScanByHotelId: Map<string, LatestHotelScan>
) {
  const hotels = portfolio.hotels.map((h) => h.hotel);

  // Santé du portefeuille — retours réels Phase C (2026-09-02) : agrégée
  // depuis le dernier scan réel de chaque hôtel membre, pas une valeur
  // figée. scannedCount compte les hôtels avec au moins un scan terminé
  // (SUCCESS ou PARTIAL_SUCCESS) ; healthScore est la moyenne des scores
  // calculés disponibles (null s'il n'y en a aucun — pas de score inventé).
  const scans = hotels.map((h) => latestScanByHotelId.get(h.id) ?? null);
  const scannedCount = scans.filter((s) => s && (s.status === "SUCCESS" || s.status === "PARTIAL_SUCCESS")).length;
  const scoresAvailable = scans.filter((s): s is LatestHotelScan => s !== null && s.healthScore !== null).map((s) => s.healthScore!);
  const healthScore = scoresAvailable.length > 0 ? scoresAvailable.reduce((sum, v) => sum + v, 0) / scoresAvailable.length : null;
  const criticalCount = scoresAvailable.filter((score) => score < 40).length;

  return {
    id: portfolio.id,
    name: portfolio.name,
    createdAt: portfolio.createdAt,
    hotels,
    health: {
      scannedCount,
      toScanCount: hotels.length - scannedCount,
      criticalCount,
      healthScore
    }
  };
}

/**
 * Portefeuilles NAVI — retours Phase C.5, §1 : le workflow "Ajouter un
 * portefeuille" doit persister en PostgreSQL plutôt que dans un state
 * frontend temporaire. Les 4 portefeuilles mockés (Paris Collection, Côte
 * d'Azur, Resorts, City Breaks) restent des données de démonstration
 * gérées côté frontend — ces routes ne concernent que les portefeuilles
 * réellement créés par un utilisateur.
 */
export async function portfoliosRoutes(app: FastifyInstance) {
  app.get("/api/portfolios", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const portfolios = await prisma.portfolio.findMany({
      where: { ownerId: user.id },
      include: { hotels: { include: { hotel: true } } },
      orderBy: { createdAt: "desc" }
    });

    const hotelIds = [...new Set(portfolios.flatMap((p) => p.hotels.map((h) => h.hotelId)))];
    const latestScans =
      hotelIds.length === 0
        ? []
        : await prisma.scanHotel.findMany({
            where: { hotelId: { in: hotelIds } },
            orderBy: { startedAt: "desc" },
            distinct: ["hotelId"],
            select: { hotelId: true, status: true, healthScore: true }
          });
    const latestScanByHotelId = new Map(latestScans.map((s) => [s.hotelId, { status: s.status, healthScore: s.healthScore }]));

    return portfolios.map((p) => serializePortfolio(p, latestScanByHotelId));
  });

  app.post("/api/portfolios", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const body = createPortfolioSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0]?.message ?? "Requête invalide." });
    }

    const matchingHotels = await prisma.hotel.count({ where: { id: { in: body.data.hotelIds } } });
    if (matchingHotels !== body.data.hotelIds.length) {
      return reply.code(400).send({ error: "Un ou plusieurs hôtels sélectionnés sont introuvables." });
    }

    const portfolio = await prisma.portfolio.create({
      data: {
        name: body.data.name,
        ownerId: user.id,
        hotels: { create: body.data.hotelIds.map((hotelId) => ({ hotelId })) }
      },
      include: { hotels: { include: { hotel: true } } }
    });

    return reply.code(201).send(serializePortfolio(portfolio, new Map()));
  });
}
