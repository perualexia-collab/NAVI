import type { Page } from "playwright";
import type { ScanStepName } from "@navi/shared";
import { selectHotel, openCustomerAnalysis, openActivity, openRevenue, openMarketingStats, applyPeriodWithToggle, setMarketingPeriod } from "./core/navigation.js";
import { sleep } from "./core/utils.js";
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

const STEP_ATTEMPTS = 2;

/**
 * Un ré-essai automatique (retours réels 2026-09-03, "East Paris Suite",
 * période personnalisée) : Expérience peut mettre plus longtemps que le
 * délai fixe post-validation (`applyPeriodWithToggle`) à recalculer ses
 * statistiques sur une période personnalisée — la première tentative lit
 * alors une page pas encore à jour. `fn` rejoue l'étape en entier
 * (navigation + période + lecture), pas juste la lecture : un second
 * passage complet laisse largement le temps à Expérience de finir son
 * calcul.
 */
async function runStep<T>(step: ScanStepName, fn: () => Promise<T>): Promise<StepResult<T>> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= STEP_ATTEMPTS; attempt++) {
    try {
      const data = await fn();
      return { status: "OK", data, error: null };
    } catch (error) {
      lastError = error;
      if (attempt < STEP_ATTEMPTS) {
        console.warn(`[collect-hotel-kpis] Étape ${step} en échec (tentative ${attempt}/${STEP_ATTEMPTS}) — nouvel essai :`, error instanceof Error ? error.message : error);
        await sleep(3000);
      }
    }
  }
  return { status: "ERROR", data: null, error: handleExperienceError(step, lastError) };
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
