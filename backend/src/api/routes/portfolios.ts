import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireUser } from "../require-auth.js";

const createPortfolioSchema = z.object({
  name: z.string().trim().min(1, "Nom du portefeuille requis."),
  hotelIds: z.array(z.string().min(1)).min(1, "Sélectionne au moins un hôtel.")
});

const updatePortfolioSchema = z.object({
  name: z.string().trim().min(1, "Nom du portefeuille requis.").optional(),
  hotelIds: z.array(z.string().min(1)).min(1, "Sélectionne au moins un hôtel.").optional()
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

async function getLatestScanByHotelId(hotelIds: string[]): Promise<Map<string, LatestHotelScan>> {
  if (hotelIds.length === 0) return new Map();
  const latestScans = await prisma.scanHotel.findMany({
    where: { hotelId: { in: hotelIds } },
    orderBy: { startedAt: "desc" },
    distinct: ["hotelId"],
    select: { hotelId: true, status: true, healthScore: true }
  });
  return new Map(latestScans.map((s) => [s.hotelId, { status: s.status, healthScore: s.healthScore }]));
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
    const latestScanByHotelId = await getLatestScanByHotelId(hotelIds);

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

    const latestScanByHotelId = await getLatestScanByHotelId(body.data.hotelIds);
    return reply.code(201).send(serializePortfolio(portfolio, latestScanByHotelId));
  });

  app.patch("/api/portfolios/:portfolioId", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { portfolioId } = request.params as { portfolioId: string };
    const existing = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!existing || existing.ownerId !== user.id) return reply.code(404).send({ error: "Portefeuille introuvable." });

    const body = updatePortfolioSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0]?.message ?? "Requête invalide." });
    }

    if (body.data.hotelIds) {
      const matchingHotels = await prisma.hotel.count({ where: { id: { in: body.data.hotelIds } } });
      if (matchingHotels !== body.data.hotelIds.length) {
        return reply.code(400).send({ error: "Un ou plusieurs hôtels sélectionnés sont introuvables." });
      }
    }

    await prisma.$transaction(async (tx) => {
      if (body.data.name !== undefined) {
        await tx.portfolio.update({ where: { id: portfolioId }, data: { name: body.data.name } });
      }
      if (body.data.hotelIds) {
        await tx.portfolioHotel.deleteMany({ where: { portfolioId } });
        await tx.portfolioHotel.createMany({ data: body.data.hotelIds.map((hotelId) => ({ portfolioId, hotelId })) });
      }
    });

    const updated = await prisma.portfolio.findUniqueOrThrow({
      where: { id: portfolioId },
      include: { hotels: { include: { hotel: true } } }
    });
    const latestScanByHotelId = await getLatestScanByHotelId(updated.hotels.map((h) => h.hotelId));

    return serializePortfolio(updated, latestScanByHotelId);
  });

  app.delete("/api/portfolios/:portfolioId", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { portfolioId } = request.params as { portfolioId: string };
    const existing = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!existing || existing.ownerId !== user.id) return reply.code(404).send({ error: "Portefeuille introuvable." });

    await prisma.portfolio.delete({ where: { id: portfolioId } });
    // 200 + corps JSON plutôt que 204 : request() (frontend/src/lib/api.ts)
    // appelle systématiquement response.json() sur une réponse ok, comme
    // pour /auth/logout.
    return reply.code(200).send({ ok: true });
  });
}
