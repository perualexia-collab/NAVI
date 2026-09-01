import type { Page } from "playwright";
import { sleep } from "./utils.js";
import { PERIOD_PRESETS, type ScanPeriod } from "./config.js";

/**
 * Navigation générique Expérience — porté à l'identique depuis
 * docs/reference/moteur-experience-existant.js (bloc 2/8). Séquences et
 * timings préservés tels quels ; seuls les noms sont alignés sur le
 * vocabulaire générique du brief §5 (loginToExperience, selectHotel,
 * navigateToPage, selectPeriod).
 */

export async function goToHotelList(page: Page): Promise<void> {
  const existingSearch = page.getByRole("searchbox", { name: /Rechercher/i });
  if (await existingSearch.first().isVisible().catch(() => false)) return;

  const xpLink = page.getByRole("link", { name: "XP", exact: true });
  if (await xpLink.first().isVisible().catch(() => false)) {
    await xpLink.first().click();
    await sleep(800);
  }

  const search = page.getByRole("searchbox", { name: /Rechercher/i });
  await search.first().waitFor({ state: "visible", timeout: 30000 });
}

export async function selectHotel(page: Page, hotelName: string): Promise<void> {
  await goToHotelList(page);

  const search = page.getByRole("searchbox", { name: /Rechercher/i }).first();
  await search.fill("");
  await sleep(200);
  await search.fill(hotelName);

  // Certaines interfaces Expérience ne réagissent pas immédiatement au fill().
  await search.press("Space");
  await search.press("Backspace");
  await sleep(700);

  let hotelLink = page.getByRole("link", { name: hotelName, exact: true });
  if (!(await hotelLink.first().isVisible().catch(() => false))) {
    hotelLink = page.getByText(hotelName, { exact: true });
  }

  await hotelLink.first().waitFor({ state: "visible", timeout: 30000 });
  await hotelLink.first().click();
  await sleep(1200);
}

/** Séquence validée : Changer d'espace → Reporting. */
export async function openReporting(page: Page): Promise<void> {
  const reportingLinks = page.getByRole("link", { name: /Activité|Analyse base client|Revenu/i });
  if (await reportingLinks.first().isVisible().catch(() => false)) return;

  const changeSpace = page.getByRole("button", { name: /Changer d'espace/i });
  await changeSpace.waitFor({ state: "visible", timeout: 30000 });
  await changeSpace.click();

  const reporting = page.getByRole("button", { name: /Reporting/i });
  await reporting.waitFor({ state: "visible", timeout: 30000 });
  await reporting.click();
  await sleep(700);
}

/**
 * Applique une période préréglée via le toggle (Reporting) — Expérience :
 * toggle → preset → Valider. Seul le mode "preset" est supporté à ce
 * stade (cf. backend/experience/core/config.ts).
 */
export async function applyPeriodWithToggle(page: Page, period: ScanPeriod): Promise<void> {
  if (!period || period.mode !== "preset") {
    throw new Error("Pour ce vertical slice, NAVI n'attend qu'une période preset Expérience.");
  }

  const label = PERIOD_PRESETS[period.value];
  if (!label) throw new Error(`Preset de période inconnu : ${period.value}`);

  const toggle = page.locator(".bigicon.toggle > .button").first();
  await toggle.waitFor({ state: "visible", timeout: 15000 });
  await toggle.click();

  const preset = page.getByRole("button", { name: label, exact: false });
  await preset.waitFor({ state: "visible", timeout: 10000 });
  await preset.click();

  const validate = page.getByRole("button", { name: "Valider" });
  await validate.waitFor({ state: "visible", timeout: 10000 });
  await validate.click();
  await sleep(1800);
}

export async function openCustomerAnalysis(page: Page): Promise<void> {
  await openReporting(page);
  const link = page.getByRole("link", { name: /Analyse base client/i });
  await link.waitFor({ state: "visible", timeout: 30000 });
  await link.click();
  await sleep(1800);
}

export async function openActivity(page: Page): Promise<void> {
  await openReporting(page);
  const link = page.getByRole("link", { name: /Activité/i });
  await link.waitFor({ state: "visible", timeout: 30000 });
  await link.click();
  await sleep(1800);
}

/** IMPORTANT : Returning Guests est lu APRÈS openRevenue(). */
export async function openRevenue(page: Page): Promise<void> {
  await openReporting(page);
  const link = page.getByRole("link", { name: /Revenu/i });
  await link.waitFor({ state: "visible", timeout: 30000 });
  await link.click();
  await sleep(1800);
}

export async function openMarketingStats(page: Page): Promise<void> {
  await openReporting(page);
  const link = page.getByRole("link", { name: /Statistiques Marketing/i });
  await link.waitFor({ state: "visible", timeout: 30000 });
  await link.click();
  await sleep(1500);
}

export async function setMarketingPeriod(page: Page, period: ScanPeriod): Promise<void> {
  const label = PERIOD_PRESETS[period.value];
  if (!label) throw new Error(`Preset marketing inconnu : ${period.value}`);

  const periodControl = page.getByText("Période", { exact: true }).first();
  await periodControl.waitFor({ state: "visible", timeout: 15000 });
  await periodControl.click();

  const presetButton = page.getByRole("button", { name: label, exact: false });
  await presetButton.waitFor({ state: "visible", timeout: 10000 });
  await presetButton.click();

  await page.getByRole("button", { name: "Valider" }).click();
  await sleep(1800);
}
