import type { Page } from "playwright";
import type { ScanStepName } from "@navi/shared";
import { selectHotel, openCustomerAnalysis, openActivity, openRevenue, openMarketingStats, applyPeriodWithToggle, setMarketingPeriod } from "./core/navigation.js";
import type { ScanPeriod } from "./core/config.js";
import { scrapeGeneralKPIs, type BaseKpis } from "./scrapers/base.js";
import { scrapeEmailCapture, type EmailCaptureKpis } from "./scrapers/capture.js";
import { scrapeRevenueOTAKPIs, type OtaKpis } from "./scrapers/ota.js";
import { scrapeReturningGuests, type ReturningGuestsKpis } from "./scrapers/returning-guests.js";
import { scrapeMarketingKPIs, type MarketingKpis } from "./scrapers/marketing.js";
import { handleExperienceError, type ClassifiedExperienceError } from "./errors.js";

/**
 * Collecte des KPI d'un hôtel dans Expérience — orchestration de bloc 3/8
 * (scanHotel(), partie collecte uniquement ; scoring et signaux restent
 * dans backend/src/services, appelés séparément par backend/scans).
 *
 * Différence assumée avec le script d'origine : chaque étape est isolée
 * dans son propre try/catch pour produire un statut PARTIAL_SUCCESS
 * granulaire par donnée (brief §12), plutôt qu'un échec global unique.
 */
export interface StepResult<T> {
  status: "OK" | "ERROR";
  data: T | null;
  error: ClassifiedExperienceError | null;
}

export interface CollectHotelKpisResult {
  base: StepResult<BaseKpis>;
  capture: StepResult<EmailCaptureKpis>;
  ota: StepResult<OtaKpis>;
  returning: StepResult<ReturningGuestsKpis>;
  marketing: StepResult<MarketingKpis>;
}

async function runStep<T>(step: ScanStepName, fn: () => Promise<T>): Promise<StepResult<T>> {
  try {
    const data = await fn();
    return { status: "OK", data, error: null };
  } catch (error) {
    return { status: "ERROR", data: null, error: handleExperienceError(step, error) };
  }
}

export async function collectHotelKpis(page: Page, hotelName: string, period: ScanPeriod): Promise<CollectHotelKpisResult> {
  await selectHotel(page, hotelName);

  const base = await runStep("BASE", async () => {
    await openCustomerAnalysis(page);
    await applyPeriodWithToggle(page, period);
    return scrapeGeneralKPIs(page);
  });

  const capture = await runStep("CAPTURE", async () => {
    await openActivity(page);
    await applyPeriodWithToggle(page, period);
    return scrapeEmailCapture(page);
  });

  const ota = await runStep("OTA", async () => {
    await openRevenue(page);
    return scrapeRevenueOTAKPIs(page);
  });

  // IMPORTANT : reste sur la page Revenu déjà ouverte par l'étape OTA
  // (comportement du script d'origine) — si OTA a échoué avant même
  // d'ouvrir Revenu, cette étape échouera de façon indépendante et
  // explicite plutôt que silencieuse.
  const returning = await runStep("RETURNING", () => scrapeReturningGuests(page));

  const marketing = await runStep("MARKETING", async () => {
    await openMarketingStats(page);
    await setMarketingPeriod(page, period);
    return scrapeMarketingKPIs(page);
  });

  return { base, capture, ota, returning, marketing };
}
