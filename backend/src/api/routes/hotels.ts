import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireUser } from "../require-auth.js";
import { runHotelScan } from "../../../scans/run-hotel-scan.js";
import { PersistentProfileSessionProvider } from "../../../experience/core/session.js";
import type { Env } from "../../config/env.js";

const presetPeriodSchema = z.object({
  mode: z.literal("preset"),
  value: z.enum(["last12Months", "thisYear", "thisMonth", "lastMonth"])
});

const customPeriodSchema = z.object({
  mode: z.literal("custom"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de début invalide."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de fin invalide.")
});

export const periodSchema = z
  .discriminatedUnion("mode", [presetPeriodSchema, customPeriodSchema])
  .refine((period) => period.mode !== "custom" || period.startDate <= period.endDate, {
    message: "La date de début doit précéder la date de fin."
  });

const createHotelSchema = z.object({
  name: z.string().trim().min(1, "Nom de l'hôtel requis.")
});

export async function hotelsRoutes(app: FastifyInstance, options: { env: Env }) {
  app.get("/api/hotels", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    return prisma.hotel.findMany({ orderBy: { name: "asc" } });
  });

  // Ajouter un hôtel — retours Phase C.5, §2 : le nom est la seule
  // information métier nécessaire à ce stade. La vérification Expérience
  // (recherche Playwright + normalisation de nom) n'est PAS implémentée
  // ici (hors scope de cette passe) : l'hôtel est créé "à vérifier",
  // experienceLabel reprend le nom saisi (c'est ce libellé qui sera
  // recherché dans Expérience plus tard).
  app.post("/api/hotels", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const body = createHotelSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0]?.message ?? "Requête invalide." });
    }

    const hotel = await prisma.hotel.create({
      data: { name: body.data.name, experienceLabel: body.data.name, experienceStatus: "TO_VERIFY" }
    });
    return reply.code(201).send(hotel);
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

    // Estimation du temps restant pendant un scan en cours (retours réels
    // Phase C, 2026-09-02) — moyenne des scans terminés précédents, pas une
    // valeur inventée. null tant qu'aucun scan n'a de durationMs connu.
    const durationAgg = await prisma.scanHotel.aggregate({
      where: { hotelId, durationMs: { not: null } },
      _avg: { durationMs: true }
    });

    const latestScanHotel = await prisma.scanHotel.findFirst({
      where: { hotelId },
      orderBy: { startedAt: "desc" },
      include: {
        scan: { select: { period: true } },
        steps: true,
        errors: true,
        kpiResults: { include: { kpiDefinition: true }, orderBy: { id: "asc" } },
        signalResults: { include: { signal: true } }
      }
    });

    return {
      hotel,
      scanCount,
      averageScanDurationMs: durationAgg._avg.durationMs,
      latestScan: latestScanHotel && {
        scanHotelId: latestScanHotel.id,
        period: latestScanHotel.scan.period,
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
          available: result.available,
          previousValue: result.previousValue,
          evolutionPoints: result.evolutionPoints
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
        sessionProvider,
        credentials: {
          email: options.env.EXPERIENCE_SERVICE_ACCOUNT_EMAIL,
          password: options.env.EXPERIENCE_SERVICE_ACCOUNT_PASSWORD
        }
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
