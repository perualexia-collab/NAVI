import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireUser } from "../require-auth.js";
import { runHotelScan } from "../../../scans/run-hotel-scan.js";
import { executeAudienceCompute } from "../../../scans/run-audience-compute.js";
import { executeP11OpportunityFinder } from "../../../scans/run-p11-opportunity-finder.js";
import { executeP10Comparison } from "../../../scans/run-p10-comparison.js";
import { PersistentProfileSessionProvider } from "../../../experience/core/session.js";
import type { Env } from "../../config/env.js";
import type { ScanPeriod } from "../../../experience/core/config.js";
import { P11_OPPORTUNITIES } from "../../../experience/audience-builder/p11-opportunities.js";
import { calculateOpportunityScore } from "../../services/scoring/p11-opportunity.js";
import { P10_LIBRARY, AUDIENCE_TAG_TO_DEFINITION_ID, currentMonthNameFR } from "../../../experience/audience-builder/p10-campaigns.js";

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
        signalResults: { include: { signal: true, recommendations: true } }
      }
    });

    // Phase E2 — dernière mesure connue par définition d'audience (pas
    // comparée, comparisonId null : réservé à E3/P10-P11). `distinct` +
    // `orderBy` (DISTINCT ON Postgres) donne la ligne la plus récente par
    // audienceDefinitionId, même mécanique que "dernier scan par hôtel".
    const latestAudienceResults = await prisma.audienceResult.findMany({
      where: { hotelId, comparisonId: null },
      orderBy: [{ audienceDefinitionId: "asc" }, { measuredAt: "desc" }],
      distinct: ["audienceDefinitionId"]
    });
    const audienceResultByDefinitionId = new Map(latestAudienceResults.map((result) => [result.audienceDefinitionId, result]));

    // Phase E3 — dernière comparaison P11 connue pour cet hôtel. Les
    // scores (volume/potentiel/actionnabilité) sont recalculés à la
    // lecture depuis P11_OPPORTUNITIES — fonctions pures, pas besoin de
    // les persister.
    const latestP11Comparison = await prisma.audienceComparison.findFirst({
      where: { hotelId, playbookId: "P11" },
      orderBy: { id: "desc" },
      include: { results: { include: { audienceDefinition: true } } }
    });
    const p11Comparison = latestP11Comparison && {
      id: latestP11Comparison.id,
      chosenResultId: latestP11Comparison.chosenResultId,
      results: latestP11Comparison.results.map((result) => {
        const opportunity = P11_OPPORTUNITIES.find((candidate) => candidate.id === result.audienceDefinitionId);
        const scoring = opportunity ? calculateOpportunityScore(opportunity, result.recipients) : null;
        return {
          id: result.id,
          audienceDefinitionId: result.audienceDefinitionId,
          name: result.audienceDefinition.name,
          recipients: result.recipients,
          highlighted: result.highlighted,
          totalScore: scoring?.totalScore ?? null,
          level: scoring?.level ?? null
        };
      })
    };

    // Phase E3 — dernière comparaison P10 connue. Contrairement à P11
    // (pas de score numérique) : `highlighted` est déjà la règle ⭐
    // (returningRate < 7 %), persistée telle quelle au moment de la
    // mesure — pas recalculée ici. Le nom/angle/pourquoi-maintenant de
    // chaque campagne sont retrouvés dans la bibliothèque du MOIS ACTUEL
    // (les campagnes tournent chaque mois, contrairement aux tags
    // d'audience qui sont stables) ; si un résultat persisté ne
    // correspond à aucune campagne du mois en cours (comparaison datant
    // d'un mois précédent), on retombe sur le seul nom du tag d'audience.
    const currentMonth = currentMonthNameFR();
    const campaignByAudienceDefinitionId = new Map(
      (P10_LIBRARY[currentMonth] ?? []).map((campaign) => [AUDIENCE_TAG_TO_DEFINITION_ID[campaign.audience], campaign])
    );
    const latestP10Comparison = await prisma.audienceComparison.findFirst({
      where: { hotelId, playbookId: "P10" },
      orderBy: { id: "desc" },
      include: { results: { include: { audienceDefinition: true } } }
    });
    const p10Comparison = latestP10Comparison && {
      id: latestP10Comparison.id,
      chosenResultId: latestP10Comparison.chosenResultId,
      month: currentMonth,
      results: latestP10Comparison.results.map((result) => {
        const campaign = campaignByAudienceDefinitionId.get(result.audienceDefinitionId);
        return {
          id: result.id,
          audienceDefinitionId: result.audienceDefinitionId,
          name: campaign?.name ?? result.audienceDefinition.name,
          angle: campaign?.angle ?? null,
          whyNow: campaign?.whyNow ?? null,
          recipients: result.recipients,
          highlighted: result.highlighted
        };
      })
    };

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
        signalResults: latestScanHotel.signalResults.map((result) => {
          const recommendation = result.recommendations[0] ?? null;
          const audienceResult = recommendation?.audienceDefinitionId ? (audienceResultByDefinitionId.get(recommendation.audienceDefinitionId) ?? null) : null;

          return {
            playbookId: result.playbookId,
            name: result.signal.name,
            severity: result.signal.severity,
            trigger: result.trigger,
            recommendedAction: result.signal.recommendedAction,
            audienceMode: result.signal.audienceMode,
            // Phase E1 : rempli pour les signaux sans audience (P01, P05,
            // P08, P12) — recommandation déjà exploitable telle quelle.
            recommendationText: recommendation?.text ?? null,
            // Phase E2 — signaux à option unique (P02, P03, P04, P06, P07,
            // P09) : présent dès qu'une Recommendation a été matérialisée
            // au scan ; recipients/measuredAt restent null tant que
            // l'utilisateur n'a pas cliqué "Calculer l'audience".
            recommendationId: recommendation?.id ?? null,
            audienceDefinitionId: recommendation?.audienceDefinitionId ?? null,
            audienceResult: audienceResult && { recipients: audienceResult.recipients, measuredAt: audienceResult.measuredAt },
            // Phase E3 — MULTIPLE (P10, P11) : null tant que "Comparer..."
            // n'a pas été lancé au moins une fois.
            comparison: result.playbookId === "P11" ? p11Comparison : result.playbookId === "P10" ? p10Comparison : null
          };
        })
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

  // Phase E2 — "Calculer l'audience" pour un signal à option unique (P02,
  // P03, P04, P06, P07, P09). Synchrone comme le scan mono-hôtel
  // ci-dessus : un seul hôtel, un seul calcul à la fois, pas de fan-out à
  // gérer via la file BullMQ (réservée aux scans de portefeuille).
  app.post("/api/hotels/:hotelId/recommendations/:recommendationId/compute-audience", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { hotelId, recommendationId } = request.params as { hotelId: string; recommendationId: string };

    const recommendation = await prisma.recommendation.findUnique({
      where: { id: recommendationId },
      include: { signalResult: { include: { scanHotel: { include: { scan: true } } } } }
    });

    if (!recommendation || recommendation.signalResult.scanHotel.hotelId !== hotelId) {
      return reply.code(404).send({ error: "Recommandation introuvable." });
    }
    if (!recommendation.audienceDefinitionId) {
      return reply.code(400).send({ error: "Cette recommandation ne nécessite pas de calcul d'audience." });
    }

    const hotel = await prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } });

    const sessionProvider = new PersistentProfileSessionProvider({
      userDataDir: options.env.EXPERIENCE_PROFILE_DIR,
      headless: options.env.PLAYWRIGHT_HEADLESS
    });

    try {
      const result = await executeAudienceCompute({
        hotelId,
        hotelName: hotel.experienceLabel,
        playbookId: recommendation.signalResult.playbookId,
        audienceDefinitionId: recommendation.audienceDefinitionId,
        period: recommendation.signalResult.scanHotel.scan.period as unknown as ScanPeriod,
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
        error: error instanceof Error ? error.message : "Le calcul de l'audience a échoué dans Expérience."
      });
    }
  });

  // Phase E3 — "Comparer les opportunités" (P11). Mesure les 3 opportunités
  // du catalogue et les regroupe dans un AudienceComparison. Synchrone,
  // même raisonnement que compute-audience ci-dessus (un hôtel, un calcul
  // à la fois — pas de fan-out).
  app.post("/api/hotels/:hotelId/recommendations/:recommendationId/compare-opportunities", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { hotelId, recommendationId } = request.params as { hotelId: string; recommendationId: string };

    const recommendation = await prisma.recommendation.findUnique({
      where: { id: recommendationId },
      include: { signalResult: { include: { scanHotel: true } } }
    });

    if (!recommendation || recommendation.signalResult.scanHotel.hotelId !== hotelId) {
      return reply.code(404).send({ error: "Recommandation introuvable." });
    }
    if (recommendation.signalResult.playbookId !== "P11") {
      return reply.code(400).send({ error: "Cette recommandation ne propose pas de comparaison d'opportunités." });
    }

    const hotel = await prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } });

    const sessionProvider = new PersistentProfileSessionProvider({
      userDataDir: options.env.EXPERIENCE_PROFILE_DIR,
      headless: options.env.PLAYWRIGHT_HEADLESS
    });

    try {
      const result = await executeP11OpportunityFinder({
        hotelId,
        hotelName: hotel.experienceLabel,
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
        error: error instanceof Error ? error.message : "La comparaison des opportunités a échoué dans Expérience."
      });
    }
  });

  // Phase E3 — "Comparer les audiences" (P10). Vérifie d'abord le statut
  // des automations marketing (bloquant si non correctement actives) puis
  // mesure les 3 campagnes du mois — même raisonnement synchrone que les
  // routes ci-dessus.
  app.post("/api/hotels/:hotelId/recommendations/:recommendationId/compare-audiences", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { hotelId, recommendationId } = request.params as { hotelId: string; recommendationId: string };

    const recommendation = await prisma.recommendation.findUnique({
      where: { id: recommendationId },
      include: { signalResult: { include: { scanHotel: { include: { scan: true } } } } }
    });

    if (!recommendation || recommendation.signalResult.scanHotel.hotelId !== hotelId) {
      return reply.code(404).send({ error: "Recommandation introuvable." });
    }
    if (recommendation.signalResult.playbookId !== "P10") {
      return reply.code(400).send({ error: "Cette recommandation ne propose pas de comparaison d'audiences." });
    }

    const returningKpi = await prisma.kPIResult.findFirst({
      where: { scanHotelId: recommendation.signalResult.scanHotelId, kpiDefinitionId: "returningGuestsRate" }
    });
    if (!returningKpi || returningKpi.value === null) {
      return reply.code(400).send({ error: "Returning Guests indisponible pour ce scan — impossible d'appliquer la règle de mise en avant." });
    }

    const hotel = await prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } });

    const sessionProvider = new PersistentProfileSessionProvider({
      userDataDir: options.env.EXPERIENCE_PROFILE_DIR,
      headless: options.env.PLAYWRIGHT_HEADLESS
    });

    try {
      const result = await executeP10Comparison({
        hotelId,
        hotelName: hotel.experienceLabel,
        returningRate: returningKpi.value,
        period: recommendation.signalResult.scanHotel.scan.period as unknown as ScanPeriod,
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
        error: error instanceof Error ? error.message : "La comparaison des audiences a échoué dans Expérience."
      });
    }
  });

  // Phase E3 — enregistre le choix de l'utilisateur parmi les options
  // comparées (P11 pour l'instant). N'agit sur rien d'autre : la
  // suite du flux (brief §22) reste hors scope, prévue en Phase F.
  app.post("/api/hotels/:hotelId/audience-comparisons/:comparisonId/choose", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { hotelId, comparisonId } = request.params as { hotelId: string; comparisonId: string };
    const body = z.object({ resultId: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Identifiant de résultat requis." });

    const comparison = await prisma.audienceComparison.findUnique({
      where: { id: comparisonId },
      include: { results: true }
    });

    if (!comparison || comparison.hotelId !== hotelId) {
      return reply.code(404).send({ error: "Comparaison introuvable." });
    }
    if (!comparison.results.some((result) => result.id === body.data.resultId)) {
      return reply.code(400).send({ error: "Ce résultat n'appartient pas à cette comparaison." });
    }

    const updated = await prisma.audienceComparison.update({
      where: { id: comparisonId },
      data: { chosenResultId: body.data.resultId }
    });

    return { comparisonId: updated.id, chosenResultId: updated.chosenResultId };
  });
}
