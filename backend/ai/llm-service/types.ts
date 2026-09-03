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
