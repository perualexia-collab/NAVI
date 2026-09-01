import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireUser } from "../require-auth.js";

const createPortfolioSchema = z.object({
  name: z.string().trim().min(1, "Nom du portefeuille requis."),
  hotelIds: z.array(z.string().min(1)).min(1, "Sélectionne au moins un hôtel.")
});

function serializePortfolio(portfolio: {
  id: string;
  name: string;
  createdAt: Date;
  hotels: { hotel: { id: string; name: string; experienceLabel: string; experienceHotelId: string | null; experienceStatus: string; disabled: boolean; lastConnectionCheckAt: Date | null } }[];
}) {
  return {
    id: portfolio.id,
    name: portfolio.name,
    createdAt: portfolio.createdAt,
    hotels: portfolio.hotels.map((h) => h.hotel)
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

    return portfolios.map(serializePortfolio);
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

    return reply.code(201).send(serializePortfolio(portfolio));
  });
}
