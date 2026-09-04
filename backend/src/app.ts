import Fastify from "fastify";
import cookie from "@fastify/cookie";
import type { Env } from "./config/env.js";
import { healthRoutes } from "./api/routes/health.js";
import { authRoutes } from "./api/routes/auth.js";
import { hotelsRoutes } from "./api/routes/hotels.js";
import { portfoliosRoutes } from "./api/routes/portfolios.js";
import { usersRoutes } from "./api/routes/users.js";
import { invitesRoutes } from "./api/routes/invites.js";
import { scansRoutes } from "./api/routes/scans.js";
import { dashboardRoutes } from "./api/routes/dashboard.js";
import { askNaviRoutes } from "./api/routes/ask-navi.js";
import { askNaviConversationsRoutes } from "./api/routes/ask-navi-conversations.js";

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
  await app.register(hotelsRoutes, { env });
  await app.register(portfoliosRoutes, { env });
  await app.register(usersRoutes);
  await app.register(invitesRoutes);
  await app.register(scansRoutes);
  await app.register(dashboardRoutes);
  await app.register(askNaviRoutes, { env });
  await app.register(askNaviConversationsRoutes);

  return app;
}
