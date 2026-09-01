import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL manquant — copier .env.example en .env"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET doit faire au moins 32 caractères (ex: openssl rand -hex 32)"),
  SCAN_QUEUE_CONCURRENCY: z.coerce.number().int().min(1).default(1)
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
