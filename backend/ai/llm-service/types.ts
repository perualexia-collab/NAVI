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
}

export interface LlmService {
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
}
