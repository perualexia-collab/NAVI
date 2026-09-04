import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { requireUser } from "../require-auth.js";
import type { Env } from "../../config/env.js";
import { createLlmService, LlmRateLimitError } from "../../../ai/llm-service/index.js";
import { answerQuestion, MAX_HISTORY_TURNS } from "../../../ai/ask-navi/index.js";

const askSchema = z.object({
  question: z.string().trim().min(1, "Question requise."),
  // Phase H6 — mémoire conversationnelle rattachée à une conversation
  // persistée (plutôt qu'un historique renvoyé par le client à chaque
  // appel, comme avant) : absent → nouvelle conversation, créée après
  // une réponse réussie.
  conversationId: z.string().min(1).optional()
});

/**
 * Phase H3/H4/H6 — question → routeIntent() → Context Builder → LLM
 * Service → réponse, avec sauvegarde de la conversation en base (Phase
 * H6, demande explicite — jusque-là purement en mémoire côté frontend).
 * Un seul appel LLM par question, jamais un second pour "décider quoi
 * chercher" (déjà fait par routeIntent(), sans LLM).
 *
 * Seuls les échanges réussis sont persistés — un échec (429, 502) ne
 * crée ni conversation ni message : c'est retentable, pas un historique
 * à conserver.
 *
 * 503 (pas 500) si aucun provider LLM n'est configuré — état légitime
 * (GROQ_API_KEY optionnel, cf. backend/src/config/env.ts) tant que
 * l'utilisateur n'a pas renseigné sa clé, pas une erreur serveur.
 */
export async function askNaviRoutes(app: FastifyInstance, options: { env: Env }) {
  app.post("/api/ask-navi", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const body = askSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0]?.message ?? "Requête invalide." });
    }

    let conversation = null;
    if (body.data.conversationId) {
      conversation = await prisma.askNaviConversation.findUnique({ where: { id: body.data.conversationId } });
      if (!conversation || conversation.userId !== user.id) {
        return reply.code(404).send({ error: "Conversation introuvable." });
      }
    }

    const recentMessages = conversation
      ? await prisma.askNaviMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: "desc" },
          take: MAX_HISTORY_TURNS
        })
      : [];
    const history = recentMessages.reverse().map((m) => ({ question: m.question, answer: m.answer }));

    let llmService;
    try {
      llmService = createLlmService(options.env);
    } catch (error) {
      request.log.warn(error);
      return reply.code(503).send({
        error: "Ask NAVI n'est pas encore configuré — aucun fournisseur LLM renseigné (voir docs/reference/phase-h-notes.md)."
      });
    }

    try {
      const result = await answerQuestion({ question: body.data.question, userId: user.id, llmService, history });

      const savedConversation = conversation
        ? await prisma.askNaviConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } })
        : await prisma.askNaviConversation.create({ data: { userId: user.id, title: body.data.question.slice(0, 200) } });

      await prisma.askNaviMessage.create({
        data: {
          conversationId: savedConversation.id,
          question: body.data.question,
          answer: result.answer,
          // AskNaviSource[] est déjà un JSON valide — cast requis, Prisma
          // n'infère pas InputJsonValue depuis un type d'objet nommé.
          sources: result.sources as unknown as Prisma.InputJsonValue
        }
      });

      return { ...result, conversationId: savedConversation.id };
    } catch (error) {
      // Un 429 (quota atteint, plan gratuit) est un état attendu et
      // temporaire — retour réel 2026-09-03 : le distinguer d'une vraie
      // panne évite un message trompeur ("n'a pas pu répondre").
      if (error instanceof LlmRateLimitError) {
        request.log.warn(error);
        return reply.code(429).send({ error: "Limite de requêtes Groq atteinte (plan gratuit) — réessaie dans quelques secondes." });
      }
      request.log.error(error);
      return reply.code(502).send({ error: "Ask NAVI n'a pas pu répondre — réessaie dans un instant." });
    }
  });
}
