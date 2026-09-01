import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/prisma.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "ok" };
    } catch {
      return { status: "degraded", database: "unreachable" };
    }
  });
}
