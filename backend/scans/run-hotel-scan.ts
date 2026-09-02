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

const STEP_NAMES: ScanStepName[] = ["BASE", "CAPTURE", "OTA", "RETURNING", "MARKETING"];

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

/**
 * Orchestration du premier vertical slice — brief §49 :
 * sélection hôtel + période → scan → Playwright → Expérience →
 * récupération des données → scoring/signaux → stockage PostgreSQL.
 *
 * Un seul hôtel, aucune queue (concurrence = 1 imposée par construction :
 * cette fonction ouvre et referme sa propre session Playwright, appelée
 * séquentiellement). La queue BullMQ multi-hôtels reste Phase D.
 *
 * Scoring/signaux ne sont calculés QUE si les 5 étapes ont réussi
 * (SUCCESS) — décision volontaire, pas un oubli : calculer un score à
 * partir de données partielles reviendrait à inventer une valeur pour ce
 * qui manque (calculateCRMHealth traite une entrée manquante comme 0, ce
 * qui pénaliserait injustement l'hôtel). En PARTIAL_SUCCESS, les KPI
 * récupérés sont stockés et affichables, mais healthScore/signaux restent
 * null plutôt que calculés sur une base tronquée. À confirmer — voir le
 * message de fin de session.
 */
export async function runHotelScan(options: RunHotelScanOptions): Promise<RunHotelScanResult> {
  const hotel = await prisma.hotel.findUniqueOrThrow({ where: { id: options.hotelId } });

  const scan = await prisma.scan.create({
    data: {
      requestedById: options.requestedById,
      period: options.period as object
    }
  });

  const scanHotel = await prisma.scanHotel.create({
    data: {
      scanId: scan.id,
      hotelId: hotel.id,
      status: "PENDING",
      steps: { create: STEP_NAMES.map((name) => ({ name, status: "PENDING" as StepStatus })) }
    }
  });

  await prisma.scanHotel.update({ where: { id: scanHotel.id }, data: { status: "RUNNING", startedAt: new Date() } });

  const startedAt = Date.now();
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
          persistStepFailure(scanHotel.id, name, classified.errorType, classified.userMessage, classified.technicalMessage)
        )
      );
      return finalizeScanHotel(scanHotel.id, "FAILED", startedAt);
    }

    await Promise.all(STEP_NAMES.map((name) => persistStepOutcome(scanHotel.id, name, collectResult)));

    const kpiRows = mapKpiResults(collectResult);
    await prisma.kPIResult.createMany({
      data: kpiRows.map((row) => ({ scanHotelId: scanHotel.id, kpiDefinitionId: row.kpiDefinitionId, value: row.value, available: row.available }))
    });

    const allStepsOk = STEP_NAMES.every((name) => stepOf(collectResult, name).status === "OK");

    if (allStepsOk) {
      await computeAndPersistScoreAndSignals(scanHotel.id, collectResult);
    }

    const status: ScanHotelStatus = allStepsOk ? "SUCCESS" : STEP_NAMES.some((name) => stepOf(collectResult, name).status === "OK") ? "PARTIAL_SUCCESS" : "FAILED";

    return finalizeScanHotel(scanHotel.id, status, startedAt);
  } finally {
    await session.close();
    await prisma.scan.update({ where: { id: scan.id }, data: { finishedAt: new Date() } });
  }
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
    await prisma.signalResult.createMany({
      data: signals.map((signal) => ({ scanHotelId, playbookId: signal.playbookId, trigger: signal.trigger }))
    });
  }
}

async function finalizeScanHotel(scanHotelId: string, status: ScanHotelStatus, startedAt: number): Promise<RunHotelScanResult> {
  const scanHotel = await prisma.scanHotel.update({
    where: { id: scanHotelId },
    data: { status, finishedAt: new Date(), durationMs: Date.now() - startedAt }
  });

  return { scanId: scanHotel.scanId, scanHotelId: scanHotel.id, status };
}
