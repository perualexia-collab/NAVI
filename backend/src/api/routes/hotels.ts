import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireUser } from "../require-auth.js";
import { runHotelScan } from "../../../scans/run-hotel-scan.js";
import { PersistentProfileSessionProvider } from "../../../experience/core/session.js";
import type { Env } from "../../config/env.js";

const periodSchema = z.object({
  mode: z.literal("preset"),
  value: z.enum(["last3Months", "last6Months", "last12Months"])
});

export async function hotelsRoutes(app: FastifyInstance, options: { env: Env }) {
  app.get("/api/hotels", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    return prisma.hotel.findMany({ orderBy: { name: "asc" } });
  });

  app.get("/api/hotels/:hotelId", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { hotelId } = request.params as { hotelId: string };
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) return reply.code(404).send({ error: "Hôtel introuvable." });
    return hotel;
  });

  app.get("/api/hotels/:hotelId/health", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { hotelId } = request.params as { hotelId: string };
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) return reply.code(404).send({ error: "Hôtel introuvable." });

    const scanCount = await prisma.scanHotel.count({ where: { hotelId, status: { in: ["SUCCESS", "PARTIAL_SUCCESS"] } } });

    const latestScanHotel = await prisma.scanHotel.findFirst({
      where: { hotelId },
      orderBy: { startedAt: "desc" },
      include: {
        steps: true,
        errors: true,
        kpiResults: { include: { kpiDefinition: true } },
        signalResults: { include: { signal: true } }
      }
    });

    return {
      hotel,
      scanCount,
      latestScan: latestScanHotel && {
        scanHotelId: latestScanHotel.id,
        status: latestScanHotel.status,
        startedAt: latestScanHotel.startedAt,
        finishedAt: latestScanHotel.finishedAt,
        durationMs: latestScanHotel.durationMs,
        healthScore: latestScanHotel.healthScore,
        healthLevel: latestScanHotel.healthLevel,
        scoreBreakdown: {
          base: latestScanHotel.baseScore,
          capture: latestScanHotel.captureScore,
          ota: latestScanHotel.otaScore,
          loyalty: latestScanHotel.loyaltyScore,
          activation: latestScanHotel.activationScore
        },
        activationRate: latestScanHotel.activationRate,
        steps: latestScanHotel.steps.map((step) => ({ name: step.name, status: step.status })),
        errors: latestScanHotel.errors.map((error) => ({
          stepName: error.stepName,
          errorType: error.errorType,
          userMessage: error.userMessage,
          occurredAt: error.occurredAt
        })),
        kpiResults: latestScanHotel.kpiResults.map((result) => ({
          kpiDefinitionId: result.kpiDefinitionId,
          label: result.kpiDefinition.label,
          dateFilterable: result.kpiDefinition.dateFilterable,
          value: result.value,
          available: result.available
        })),
        signalResults: latestScanHotel.signalResults.map((result) => ({
          playbookId: result.playbookId,
          name: result.signal.name,
          severity: result.signal.severity,
          trigger: result.trigger,
          recommendedAction: result.signal.recommendedAction,
          audienceMode: result.signal.audienceMode
        }))
      }
    };
  });

  app.post("/api/hotels/:hotelId/scans", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { hotelId } = request.params as { hotelId: string };
    const body = periodSchema.safeParse((request.body as { period?: unknown } | undefined)?.period);
    if (!body.success) return reply.code(400).send({ error: "Période invalide." });

    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) return reply.code(404).send({ error: "Hôtel introuvable." });

    const sessionProvider = new PersistentProfileSessionProvider({
      userDataDir: options.env.EXPERIENCE_PROFILE_DIR,
      headless: options.env.PLAYWRIGHT_HEADLESS
    });

    try {
      const result = await runHotelScan({
        hotelId,
        period: body.data,
        requestedById: user.id,
        sessionProvider
      });
      return result;
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({
        error: "Le scan n'a pas pu être exécuté — Expérience est probablement inaccessible depuis cet environnement."
      });
    }
  });
}
