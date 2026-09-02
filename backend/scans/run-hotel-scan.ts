import type { ScanErrorType, ScanHotelStatus, ScanStepName, StepStatus } from "@navi/shared";
import { prisma } from "../src/db/prisma.js";
import { calculateActivationRate, calculateCRMHealth, getHealthLevel } from "../src/services/scoring/crm-health.js";
import { detectSignals } from "../src/services/signals/detect-signals.js";
import type { SessionProvider, ExperienceSession, ExperienceCredentials } from "../experience/core/session.js";
import { connectToExperience as defaultConnectToExperience } from "../experience/core/session.js";
import { collectHotelKpis as defaultCollectHotelKpis, type CollectHotelKpisResult, type StepResult } from "../experience/collect-hotel-kpis.js";
import { handleExperienceError } from "../experience/errors.js";
import type { ScanPeriod } from "../experience/core/config.js";
import { mapKpiResults } from "./map-kpi-results.js";

export const STEP_NAMES: ScanStepName[] = ["BASE", "CAPTURE", "OTA", "RETURNING", "MARKETING"];

export interface RunHotelScanOptions {
  hotelId: string;
  period: ScanPeriod;
  requestedById: string;
  sessionProvider: SessionProvider;
  /** Pré-remplissage best-effort du formulaire de connexion — la 2FA reste manuelle (cf. backend/experience/core/session.ts). */
  credentials?: ExperienceCredentials;
  /**
   * Points d'injection pour les tests (C4) — permettent de valider toute
   * l'orchestration (persistance, scoring, signaux) avec des fixtures,
   * sans navigateur ni accès réel à Expérience. Par défaut, les vraies
   * implémentations Playwright (backend/experience).
   */
  connectToExperience?: (page: ExperienceSession["page"], credentials?: ExperienceCredentials) => Promise<void>;
  collectHotelKpis?: (page: ExperienceSession["page"], hotelName: string, period: ScanPeriod) => Promise<CollectHotelKpisResult>;
}

export interface RunHotelScanResult {
  scanId: string;
  scanHotelId: string;
  status: ScanHotelStatus;
}

export interface ExecuteHotelScanOptions {
  scanId: string;
  scanHotelId: string;
  hotelId: string;
  period: ScanPeriod;
  sessionProvider: SessionProvider;
  credentials?: ExperienceCredentials;
  connectToExperience?: (page: ExperienceSession["page"], credentials?: ExperienceCredentials) => Promise<void>;
  collectHotelKpis?: (page: ExperienceSession["page"], hotelName: string, period: ScanPeriod) => Promise<CollectHotelKpisResult>;
}

/**
 * Cœur de l'orchestration d'un scan pour un hôtel — Playwright → Expérience
 * → récupération des données → scoring/signaux → stockage PostgreSQL, pour
 * un `Scan`/`ScanHotel` déjà créés (PENDING). Extrait de `runHotelScan()`
 * en Phase D1 pour être réutilisé à la fois par le scan mono-hôtel
 * (Phase C, ci-dessous) et par le worker BullMQ multi-hôtels
 * (backend/scans/worker.ts) — comportement inchangé pour le premier.
 *
 * Scoring/signaux ne sont calculés QUE si les 5 étapes ont réussi
 * (SUCCESS) — décision volontaire, pas un oubli : calculer un score à
 * partir de données partielles reviendrait à inventer une valeur pour ce
 * qui manque (calculateCRMHealth traite une entrée manquante comme 0, ce
 * qui pénaliserait injustement l'hôtel). En PARTIAL_SUCCESS, les KPI
 * récupérés sont stockés et affichables, mais healthScore/signaux restent
 * null plutôt que calculés sur une base tronquée.
 *
 * Robustesse (Phase D3) : un ScanHotel ne doit jamais rester bloqué à
 * RUNNING/PENDING indéfiniment, quelle que soit la cause d'échec — y
 * compris avant même l'ouverture de la session Playwright (hôtel
 * introuvable, `sessionProvider.open()` en échec...). Le corps entier est
 * donc protégé par un filet de sécurité générique (`handleFatalScanError`)
 * en plus du traitement dédié connexion/collecte déjà présent depuis la
 * Phase C — les deux réutilisent `handleExperienceError()`.
 */
export async function executeHotelScan(options: ExecuteHotelScanOptions): Promise<RunHotelScanResult> {
  const startedAt = Date.now();

  try {
    const hotel = await prisma.hotel.findUniqueOrThrow({ where: { id: options.hotelId } });
    await prisma.scanHotel.update({ where: { id: options.scanHotelId }, data: { status: "RUNNING", startedAt: new Date() } });

    const session = await options.sessionProvider.open();
    const connect = options.connectToExperience ?? defaultConnectToExperience;
    const collect = options.collectHotelKpis ?? defaultCollectHotelKpis;

    try {
      let collectResult: CollectHotelKpisResult;

      try {
        await connect(session.page, options.credentials);
        collectResult = await collect(session.page, hotel.experienceLabel, options.period);
      } catch (error) {
        // Échec avant même la collecte (session/authentification) : les 5
        // étapes sont marquées en erreur avec la même cause.
        const classified = handleExperienceError("BASE", error);
        await Promise.all(
          STEP_NAMES.map((name) =>
            persistStepFailure(options.scanHotelId, name, classified.errorType, classified.userMessage, classified.technicalMessage)
          )
        );
        return await finalizeScanHotel(options.scanHotelId, "FAILED", startedAt);
      }

      await Promise.all(STEP_NAMES.map((name) => persistStepOutcome(options.scanHotelId, name, collectResult)));

      const kpiRows = mapKpiResults(collectResult);
      await prisma.kPIResult.createMany({
        data: kpiRows.map((row) => ({
          scanHotelId: options.scanHotelId,
          kpiDefinitionId: row.kpiDefinitionId,
          value: row.value,
          available: row.available,
          previousValue: row.previousValue ?? null,
          evolutionPoints: row.evolutionPoints ?? null
        }))
      });

      const allStepsOk = STEP_NAMES.every((name) => stepOf(collectResult, name).status === "OK");

      if (allStepsOk) {
        await computeAndPersistScoreAndSignals(options.scanHotelId, collectResult);
      }

      const status: ScanHotelStatus = allStepsOk ? "SUCCESS" : STEP_NAMES.some((name) => stepOf(collectResult, name).status === "OK") ? "PARTIAL_SUCCESS" : "FAILED";

      // Un scan SUCCESS/PARTIAL_SUCCESS prouve que l'hôtel a bien été trouvé
      // et au moins partiellement scrapé dans Expérience — retours réels
      // Phase C (2026-09-02) : experienceStatus restait bloqué à TO_VERIFY
      // (valeur de création) même après un scan réel réussi.
      if (status === "SUCCESS" || status === "PARTIAL_SUCCESS") {
        await prisma.hotel.update({
          where: { id: hotel.id },
          data: { experienceStatus: "ACTIVE", lastConnectionCheckAt: new Date() }
        });
      }

      return await finalizeScanHotel(options.scanHotelId, status, startedAt);
    } finally {
      await session.close();
      await maybeFinalizeParentScan(options.scanId);
    }
  } catch (error) {
    return handleFatalScanError(options, error, startedAt);
  }
}

/**
 * Filet de sécurité générique (Phase D3) — capture toute erreur survenue
 * avant même l'ouverture de la session Playwright (hôtel introuvable,
 * `sessionProvider.open()` en échec, etc., cas non couverts par le
 * try/catch dédié connexion/collecte ci-dessus). Best-effort volontaire :
 * si la persistance elle-même échoue ici (ex. base injoignable), on logue
 * plutôt que de propager — ce chemin est déjà le dernier recours.
 */
async function handleFatalScanError(options: ExecuteHotelScanOptions, error: unknown, startedAt: number): Promise<RunHotelScanResult> {
  try {
    const classified = handleExperienceError("BASE", error);
    await Promise.all(
      STEP_NAMES.map((name) =>
        persistStepFailure(options.scanHotelId, name, classified.errorType, classified.userMessage, classified.technicalMessage)
      )
    );
    const result = await finalizeScanHotel(options.scanHotelId, "FAILED", startedAt);
    await maybeFinalizeParentScan(options.scanId);
    return result;
  } catch (persistError) {
    console.error(`[executeHotelScan] Échec de la persistance de l'erreur fatale pour scanHotel ${options.scanHotelId} :`, persistError);
    return { scanId: options.scanId, scanHotelId: options.scanHotelId, status: "FAILED" };
  }
}

/**
 * Marque le `Scan` parent terminé une fois que plus aucun de ses
 * `ScanHotel` n'est PENDING/RUNNING — fonctionne aussi bien pour un scan
 * mono-hôtel (1 seul ScanHotel, donc terminé dès qu'il l'est) que pour un
 * scan portefeuille multi-hôtels (Phase D1, terminé seulement quand le
 * dernier hôtel a fini).
 */
async function maybeFinalizeParentScan(scanId: string): Promise<void> {
  const remaining = await prisma.scanHotel.count({ where: { scanId, status: { in: ["PENDING", "RUNNING"] } } });
  if (remaining === 0) {
    await prisma.scan.update({ where: { id: scanId }, data: { finishedAt: new Date() } });
  }
}

/**
 * Orchestration du premier vertical slice — brief §49 : sélection hôtel +
 * période → scan mono-hôtel → PostgreSQL. Crée son propre Scan/ScanHotel
 * puis délègue à `executeHotelScan()`. Aucune queue ici (concurrence = 1
 * imposée par construction — appelée de façon synchrone par la route HTTP,
 * cf. backend/src/api/routes/hotels.ts) : c'est le scan portefeuille
 * multi-hôtels (backend/scans/run-portfolio-scan.ts) qui passe par la
 * queue BullMQ.
 */
export async function runHotelScan(options: RunHotelScanOptions): Promise<RunHotelScanResult> {
  const scan = await prisma.scan.create({
    data: {
      requestedById: options.requestedById,
      period: options.period as object
    }
  });

  const scanHotel = await prisma.scanHotel.create({
    data: {
      scanId: scan.id,
      hotelId: options.hotelId,
      status: "PENDING",
      steps: { create: STEP_NAMES.map((name) => ({ name, status: "PENDING" as StepStatus })) }
    }
  });

  return executeHotelScan({
    scanId: scan.id,
    scanHotelId: scanHotel.id,
    hotelId: options.hotelId,
    period: options.period,
    sessionProvider: options.sessionProvider,
    credentials: options.credentials,
    connectToExperience: options.connectToExperience,
    collectHotelKpis: options.collectHotelKpis
  });
}

function stepOf(result: CollectHotelKpisResult, name: ScanStepName): StepResult<unknown> {
  switch (name) {
    case "BASE": return result.base;
    case "CAPTURE": return result.capture;
    case "OTA": return result.ota;
    case "RETURNING": return result.returning;
    case "MARKETING": return result.marketing;
  }
}

async function persistStepOutcome(scanHotelId: string, name: ScanStepName, result: CollectHotelKpisResult): Promise<void> {
  const step = stepOf(result, name);
  if (step.status === "OK") {
    await prisma.scanStep.update({
      where: { scanHotelId_name: { scanHotelId, name } },
      data: { status: "OK", startedAt: new Date(), finishedAt: new Date() }
    });
    return;
  }

  await persistStepFailure(scanHotelId, name, step.error!.errorType, step.error!.userMessage, step.error!.technicalMessage);
}

async function persistStepFailure(
  scanHotelId: string,
  name: ScanStepName,
  errorType: ScanErrorType,
  userMessage: string,
  technicalMessage: string
): Promise<void> {
  await prisma.scanStep.update({
    where: { scanHotelId_name: { scanHotelId, name } },
    data: { status: "ERROR", startedAt: new Date(), finishedAt: new Date() }
  });
  await prisma.scanError.create({
    data: { scanHotelId, stepName: name, errorType, userMessage, technicalMessage }
  });
}

async function computeAndPersistScoreAndSignals(scanHotelId: string, result: CollectHotelKpisResult): Promise<void> {
  const base = result.base.data!;
  const capture = result.capture.data!;
  const ota = result.ota.data!;
  const returning = result.returning.data!;
  const marketing = result.marketing.data!;

  const activationRate = calculateActivationRate(marketing.total.bookings, base.usableEmails);

  const health = calculateCRMHealth({
    activabilityRate: base.activabilityRate,
    captureRate: capture.displayedRate,
    nonOtaRate: ota.nonOta.reservationShare.N,
    returningRate: returning.N,
    activationRate
  });

  const { signals } = detectSignals({
    activabilityRate: base.activabilityRate ?? 0,
    captureRate: capture.displayedRate,
    nonOtaRate: ota.nonOta.reservationShare.N,
    returningRate: returning.N,
    returningEvolution: returning.evolution ?? 0,
    activationRate: activationRate ?? 0,
    totalCrmBookings: marketing.total.bookings,
    automationBookings: marketing.automations.bookings
  });

  await prisma.scanHotel.update({
    where: { id: scanHotelId },
    data: {
      healthScore: health.totalScore,
      healthLevel: getHealthLevel(health.totalScore),
      baseScore: health.baseScore,
      captureScore: health.captureScore,
      otaScore: health.otaScore,
      loyaltyScore: health.loyaltyScore,
      activationScore: health.activationScore,
      activationRate
    }
  });

  if (signals.length > 0) {
    await persistSignalsAndRecommendations(scanHotelId, signals);
  }
}

/**
 * Phase E1 — playbooks sans audience (P01, P05, P08, P12) : leur
 * recommendedAction est un texte autonome, qui ne dépend d'aucun calcul
 * d'audience (§07/E2/E3, pas encore construit). On matérialise donc une
 * Recommendation dès le scan pour ces signaux-là — c'est déjà la
 * recommandation finale montrée à l'utilisateur, pas une étape
 * intermédiaire. Les signaux SINGLE/MULTIPLE (P02…P04, P06, P07, P09…P11)
 * restent de simples SignalResult tant que E2/E3 n'existent pas : leur
 * texte seul, sans audience mesurée, ne serait pas une recommandation
 * exploitable.
 */
async function persistSignalsAndRecommendations(scanHotelId: string, signals: { playbookId: string; trigger: string }[]): Promise<void> {
  const definitions = await prisma.signalDefinition.findMany({
    where: { playbookId: { in: signals.map((signal) => signal.playbookId) } },
    select: { playbookId: true, audienceMode: true, recommendedAction: true }
  });
  const definitionByPlaybookId = new Map(definitions.map((definition) => [definition.playbookId, definition]));

  const createdSignalResults = await Promise.all(
    signals.map((signal) =>
      prisma.signalResult.create({
        data: { scanHotelId, playbookId: signal.playbookId, trigger: signal.trigger },
        select: { id: true, playbookId: true }
      })
    )
  );

  const recommendationsToCreate = createdSignalResults.flatMap((result) => {
    const definition = definitionByPlaybookId.get(result.playbookId);
    if (!definition || definition.audienceMode !== "NONE") return [];
    return [{ scanHotelId, signalResultId: result.id, text: definition.recommendedAction }];
  });

  if (recommendationsToCreate.length > 0) {
    await prisma.recommendation.createMany({ data: recommendationsToCreate });
  }
}

async function finalizeScanHotel(scanHotelId: string, status: ScanHotelStatus, startedAt: number): Promise<RunHotelScanResult> {
  const scanHotel = await prisma.scanHotel.update({
    where: { id: scanHotelId },
    data: { status, finishedAt: new Date(), durationMs: Date.now() - startedAt }
  });

  return { scanId: scanHotel.scanId, scanHotelId: scanHotel.id, status };
}
