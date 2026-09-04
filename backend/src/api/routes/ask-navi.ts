import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../require-auth.js";
import type { Env } from "../../config/env.js";
import { createLlmService, LlmRateLimitError } from "../../../ai/llm-service/index.js";
import { answerQuestion } from "../../../ai/ask-navi/index.js";

const askSchema = z.object({ question: z.string().trim().min(1, "Question requise.") });

/**
 * Phase H3/H4 — première route réelle d'Ask NAVI (§09 Architecture
 * Proposal) : question → routeIntent() → Context Builder → LLM Service →
 * réponse. Un seul appel LLM par question, jamais un second pour
 * "décider quoi chercher" (déjà fait par routeIntent(), sans LLM).
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
      const result = await answerQuestion({ question: body.data.question, userId: user.id, llmService });
      return result;
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
