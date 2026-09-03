import "dotenv/config";
import { loadEnv } from "../src/config/env.js";
import { createLlmService } from "./llm-service/index.js";

/**
 * Test minimal de connectivité LLM Service — Phase H1 (§09 Architecture
 * Proposal). Vérifie uniquement que NAVI arrive à envoyer une requête au
 * provider configuré (Groq/Qwen aujourd'hui) et à récupérer une réponse.
 * Ne touche à AUCUNE donnée NAVI (pas de Context Builder, pas de Prisma) —
 * volontairement, pour valider le tuyau avant de brancher le contexte
 * CRM Health/signaux/recommandations dans Ask NAVI.
 */
async function main() {
  const env = loadEnv();
  const llmService = createLlmService(env);

  console.log(`→ Provider : ${env.LLM_PROVIDER} · Modèle : ${env.LLM_MODEL}`);
  console.log("→ Envoi d'une requête de test...");

  const result = await llmService.complete({
    messages: [
      { role: "system", content: "Tu es un assistant de test. Réponds en une seule courte phrase, en français." },
      { role: "user", content: "Confirme que tu me reçois bien et dis-moi quel modèle tu es." }
    ],
    maxTokens: 100
  });

  console.log("\n✅ Réponse reçue :");
  console.log(result.text);
  console.log(`\n(modèle: ${result.model}${result.usage ? ` · ${result.usage.totalTokens} tokens` : ""})`);
}

main().catch((error) => {
  console.error("❌ Échec du test de connexion LLM :", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
