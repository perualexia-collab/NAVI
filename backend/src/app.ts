import Fastify from "fastify";
import cookie from "@fastify/cookie";
import type { Env } from "./config/env.js";
import { healthRoutes } from "./api/routes/health.js";
import { authRoutes } from "./api/routes/auth.js";

export async function buildApp(env: Env) {
  const app = Fastify({
    logger:
      env.NODE_ENV === "development"
        ? { transport: { target: "pino-pretty", options: { colorize: true } } }
        : true
  });

  await app.register(cookie, { secret: env.SESSION_SECRET });

  await app.register(healthRoutes);
  await app.register(authRoutes);

  return app;
}
