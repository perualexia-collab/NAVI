import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/prisma.js";
import { requireUser } from "../require-auth.js";

const POLL_INTERVAL_MS = 1500;
const TERMINAL_STATUSES = new Set(["SUCCESS", "PARTIAL_SUCCESS", "FAILED"]);

/**
 * Progression temps réel d'un scan — Phase D2. SSE plutôt que WebSocket
 * (flux à sens unique serveur→client, exactement ce qu'il faut ici).
 * Implémenté par un poll de la base à intervalle court côté serveur
 * (1,5 s) plutôt qu'un abonnement aux évènements BullMQ — plus simple et
 * robuste pour cette première itération, et largement suffisant vu la
 * durée d'un scan (dizaines de secondes par hôtel).
 *
 * ETA : moyenne des durées de scan déjà observées (tous hôtels
 * confondus) × nombre d'hôtels restants. `null` s'il n'existe aucun
 * historique — jamais de fausse précision affichée (consigne explicite
 * de l'utilisateur pour D2).
 */
export async function scansRoutes(app: FastifyInstance) {
  app.get("/api/scans/:scanId/events", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { scanId } = request.params as { scanId: string };
    const scan = await prisma.scan.findUnique({ where: { id: scanId } });
    if (!scan || scan.requestedById !== user.id) {
      return reply.code(404).send({ error: "Scan introuvable." });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });

    const durationAgg = await prisma.scanHotel.aggregate({
      where: { durationMs: { not: null } },
      _avg: { durationMs: true }
    });
    const avgDurationMs = durationAgg._avg.durationMs;

    let closed = false;
    const interval = setInterval(() => void tick(), POLL_INTERVAL_MS);
    request.raw.on("close", () => {
      closed = true;
      clearInterval(interval);
    });

    async function tick(): Promise<void> {
      if (closed) return;

      const hotels = await prisma.scanHotel.findMany({
        where: { scanId },
        include: { hotel: { select: { name: true } } },
        orderBy: { id: "asc" }
      });

      const total = hotels.length;
      const completed = hotels.filter((h) => TERMINAL_STATUSES.has(h.status)).length;
      const pending = total - completed;
      const done = total > 0 && completed === total;

      const payload = {
        scanId,
        total,
        completed,
        done,
        etaMs: avgDurationMs && pending > 0 ? Math.round(avgDurationMs * pending) : null,
        hotels: hotels.map((h) => ({ scanHotelId: h.id, hotelId: h.hotelId, hotelName: h.hotel.name, status: h.status }))
      };

      if (closed) return;
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);

      if (done) {
        closed = true;
        clearInterval(interval);
        reply.raw.end();
      }
    }

    await tick();
  });
}
