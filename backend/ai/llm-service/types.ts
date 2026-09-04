/**
 * Interface unique du LLM Service (§09 Architecture Proposal) —
 * Ask NAVI → Context Builder → LLM Service → provider concret. Ask NAVI
 * ne parle jamais directement à un provider : uniquement à ce contrat,
 * implémenté par un adaptateur interchangeable par configuration.
 */
export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  // Certains modèles "thinking" (Qwen3.x, DeepSeek-R1...) renvoient leur
  // raisonnement brut avant la réponse finale. "hidden" ne renvoie que la
  // réponse finale — à demander explicitement par l'appelant qui sait
  // qu'il parle à ce type de modèle (le champ est ignoré sans effet par
  // un provider/modèle qui ne le supporte pas).
  reasoningFormat?: "hidden" | "parsed" | "raw";
  // Retour réel 2026-09-03 : "hidden" masque le raisonnement mais ne
  // l'empêche pas d'être généré — il consomme quand même le budget de
  // tokens (et le quota "tokens de sortie / minute" du plan gratuit
  // Groq, très vite épuisé). Pour la famille Qwen3.x sur Groq,
  // "none" désactive réellement le raisonnement (pas juste son
  // affichage) — à préférer à "hidden" seul dès que la rapidité/le coût
  // priment sur la profondeur de raisonnement (cas d'Ask NAVI : Qwen
  // reformule un résultat déjà calculé, il n'a pas besoin de réfléchir).
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh";
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmCompletionResult {
  text: string;
  model: string;
  usage?: LlmUsage;
  // Retour réel 2026-09-03 : diagnostiquer un texte vide sans ce champ
  // était impossible depuis les logs serveur seuls (statusCode 200,
  // rien d'autre) — "length" confirme que maxTokens a coupé la
  // génération (raisonnement caché compris) avant toute réponse
  // visible ; "stop" indiquerait autre chose.
  finishReason?: string;
}

export interface LlmService {
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
}

/**
 * Distingue un 429 (quota/rate limit provider — état attendu et
 * temporaire sur un plan gratuit) d'une vraie panne, pour que
 * l'appelant puisse répondre différemment (retour réel 2026-09-03 :
 * "Ask NAVI n'a pas pu répondre" générique était trompeur pour un simple
 * dépassement de quota Groq).
 */
export class LlmRateLimitError extends Error {}
