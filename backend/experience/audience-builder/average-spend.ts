import type { Page } from "playwright";
import { sleep } from "../core/utils.js";
import { openCustomerAnalysis, applyPeriodWithToggle } from "../core/navigation.js";
import type { ScanPeriod } from "../core/config.js";

/**
 * P09 — dépense moyenne par réservation, seuil dynamique du filtre montant
 * de HIGH_VALUE_ONE_TIMER. Porté à l'identique depuis
 * docs/reference/moteur-experience-existant.js (bloc 5/8) : Analyse base
 * client → Profils → Dépense moyenne → Par réservation (EUR). Ne dérive
 * volontairement PAS cette valeur du CA CRM (source différente).
 */
export async function scrapeAverageSpendPerBooking(page: Page, period: ScanPeriod): Promise<number> {
  await openCustomerAnalysis(page);
  await applyPeriodWithToggle(page, period);

  const profilesTab = page.getByRole("link", { name: "Profils", exact: true });
  if (await profilesTab.isVisible().catch(() => false)) {
    await profilesTab.click();
    await sleep(800);
  }

  const chevron = page.locator(".fal.fa-chevron-double-down").first();
  if (await chevron.isVisible().catch(() => false)) {
    await chevron.click();
    await sleep(500);
  }

  const heading = page.getByRole("heading", { name: /Dépense moyenne/i });
  if (await heading.isVisible().catch(() => false)) {
    await heading.click().catch(() => {});
    await sleep(300);
  }

  const reservationCell = page.getByRole("cell", { name: /Par réservation \(EUR\)/i });
  await reservationCell.waitFor({ state: "visible", timeout: 30000 });

  const row = reservationCell.locator("xpath=ancestor::tr[1]");
  const rowText = (await row.innerText().catch(() => ""))
    .replace(/ /g, " ")
    .trim();

  const numbers = rowText.match(/\d+(?:[.,]\d+)?/g);
  if (!numbers || numbers.length === 0) throw new Error("Impossible de lire la dépense moyenne par réservation.");

  const numericValues = numbers.map((value) => Number(value.replace(",", "."))).filter((value) => Number.isFinite(value));
  if (numericValues.length === 0) throw new Error("Valeur numérique de dépense moyenne introuvable.");

  return numericValues[numericValues.length - 1]!;
}
