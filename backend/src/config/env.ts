import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL manquant — copier .env.example en .env"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET doit faire au moins 32 caractères (ex: openssl rand -hex 32)"),
  SCAN_QUEUE_CONCURRENCY: z.coerce.number().int().min(1).default(1),
  PLAYWRIGHT_HEADLESS: z
    .string()
    .default("true")
    .transform((value) => value !== "false"),
  EXPERIENCE_PROFILE_DIR: z.string().default("./experience-profile"),
  // Optionnels : sans eux, la connexion Expérience reste 100% manuelle
  // (comportement d'origine). Avec eux, seuls email/mot de passe sont
  // pré-remplis — la 2FA reste toujours manuelle (retours Phase C, clôture).
  EXPERIENCE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  EXPERIENCE_SERVICE_ACCOUNT_PASSWORD: z.string().optional(),
  // Ask NAVI / LLM Service (§09 Architecture Proposal, Phase H) — tous
  // optionnels : sans eux, le reste de NAVI démarre et fonctionne
  // normalement, Ask NAVI n'est simplement pas branché. Provider-agnostic
  // par construction : LLM_PROVIDER ne vaut aujourd'hui que
  // "http-openai-compatible" (n'importe quel endpoint compatible OpenAI —
  // Groq, un futur self-host Ollama, etc.), jamais "groq" en dur.
  LLM_PROVIDER: z.enum(["http-openai-compatible"]).optional(),
  LLM_BASE_URL: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  // Clé secrète du provider actif — nom volontairement générique
  // (GROQ_API_KEY quand LLM_PROVIDER pointe vers Groq) plutôt que
  // LLM_API_KEY, pour rester lisible si plusieurs clés provider
  // coexistent un jour. Jamais loguée, jamais exposée au frontend.
  GROQ_API_KEY: z.string().optional()
});

export type Env = z.infer<typeof envSchema>;

/** Valide l'environnement au démarrage — échoue vite et clairement plutôt que plus tard, en silence. */
export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Configuration invalide :");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}
