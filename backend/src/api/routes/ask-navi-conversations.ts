import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/prisma.js";
import { requireUser } from "../require-auth.js";

/**
 * Historique de conversation Ask NAVI (Phase H6) — demandé explicitement
 * ("je veux qu'on ajoute une sauvegarde de l'historique"), jusque-là
 * purement en mémoire côté frontend (perdu à chaque rechargement).
 *
 * Liste + détail en une seule route (pas de pagination/chargement à la
 * demande) : le volume attendu par utilisateur reste modeste pour
 * l'instant — à revoir si ça devient un vrai problème de volume.
 */
export async function askNaviConversationsRoutes(app: FastifyInstance) {
  app.get("/api/ask-navi/conversations", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const conversations = await prisma.askNaviConversation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" } } }
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        question: message.question,
        answer: message.answer,
        sources: message.sources,
        createdAt: message.createdAt
      }))
    }));
  });

  app.delete("/api/ask-navi/conversations/:conversationId", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { conversationId } = request.params as { conversationId: string };
    const conversation = await prisma.askNaviConversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.userId !== user.id) {
      return reply.code(404).send({ error: "Conversation introuvable." });
    }

    await prisma.askNaviConversation.delete({ where: { id: conversationId } });
    return { ok: true };
  });
}
