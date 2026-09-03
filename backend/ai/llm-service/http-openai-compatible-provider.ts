import type { LlmCompletionRequest, LlmCompletionResult, LlmService } from "./types.js";

export interface HttpOpenAiCompatibleProviderOptions {
  /** Ex: "https://api.groq.com/openai/v1" — sans le "/chat/completions" final. */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Défaut 20s — un test de connectivité ne doit jamais rester bloqué en silence. */
  timeoutMs?: number;
}

/**
 * Adaptateur LLM Service générique (§09 Architecture Proposal —
 * "HttpApiAdapter : endpoint compatible OpenAI — Qwen hébergé ou autre").
 * Ne connaît RIEN de spécifique à Groq : n'importe quel endpoint qui
 * respecte le contrat /chat/completions compatible OpenAI (Groq,
 * Together, un futur self-host vLLM/Ollama derrière une passerelle
 * compatible…) fonctionne ici sans changement de code, seulement de
 * configuration (baseUrl/model/clé).
 */
export class HttpOpenAiCompatibleProvider implements LlmService {
  constructor(private readonly options: HttpOpenAiCompatibleProviderOptions) {}

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 20000);

    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          // Jamais loguée — uniquement transmise dans cet en-tête.
          Authorization: `Bearer ${this.options.apiKey}`
        },
        body: JSON.stringify({
          model: this.options.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.3,
          max_tokens: request.maxTokens ?? 512
        })
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`LLM Service : pas de réponse du provider après ${this.options.timeoutMs ?? 20000}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      // Le corps d'erreur d'un provider compatible OpenAI ne contient
      // jamais la clé (envoyée uniquement en en-tête) — sûr à logguer/
      // remonter tel quel pour diagnostiquer (modèle inconnu, quota...).
      throw new Error(`LLM Service (${response.status}) : ${errorBody.slice(0, 500)}`);
    }

    const payload = (await response.json()) as {
      model: string;
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    return {
      text: payload.choices[0]?.message.content ?? "",
      model: payload.model,
      usage: payload.usage
        ? {
            promptTokens: payload.usage.prompt_tokens,
            completionTokens: payload.usage.completion_tokens,
            totalTokens: payload.usage.total_tokens
          }
        : undefined
    };
  }
}
