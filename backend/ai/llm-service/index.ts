import type { Env } from "../../src/config/env.js";
import { HttpOpenAiCompatibleProvider } from "./http-openai-compatible-provider.js";
import type { LlmService } from "./types.js";

export type { LlmService, LlmMessage, LlmCompletionRequest, LlmCompletionResult, LlmUsage } from "./types.js";
export { LlmRateLimitError } from "./types.js";

export type LlmServiceEnv = Pick<Env, "LLM_PROVIDER" | "LLM_BASE_URL" | "LLM_MODEL" | "GROQ_API_KEY">;

/**
 * Fabrique du LLM Service actif — le choix du provider est une pure
 * question de configuration (§09 Architecture Proposal), jamais un
 * couplage en dur dans Ask NAVI. Aujourd'hui : Groq comme instance d'un
 * adaptateur générique compatible OpenAI ; demain, un autre endpoint
 * (self-host…) sans changer un seul appelant.
 */
export function createLlmService(env: LlmServiceEnv): LlmService {
  if (!env.LLM_PROVIDER) {
    throw new Error("LLM_PROVIDER manquant — copier la section Ask NAVI de backend/.env.example dans backend/.env.");
  }

  switch (env.LLM_PROVIDER) {
    case "http-openai-compatible": {
      if (!env.LLM_BASE_URL) throw new Error('LLM_BASE_URL manquant (ex: "https://api.groq.com/openai/v1").');
      if (!env.LLM_MODEL) throw new Error('LLM_MODEL manquant (ex: "qwen/qwen3.6-27b").');
      if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY manquant — renseigner dans backend/.env (jamais committé).");
      return new HttpOpenAiCompatibleProvider({
        baseUrl: env.LLM_BASE_URL,
        model: env.LLM_MODEL,
        apiKey: env.GROQ_API_KEY
      });
    }
  }
}
