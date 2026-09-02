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
 * Applique une période (préréglage ou personnalisée) via le toggle
 * (Reporting) — Expérience : toggle → préréglage OU plage de date →
 * Valider.
 */
export async function applyPeriodWithToggle(page: Page, period: ScanPeriod): Promise<void> {
  const toggle = page.locator(".bigicon.toggle > .button").first();
  await toggle.waitFor({ state: "visible", timeout: 15000 });
  await toggle.click();

  await selectPeriodInPanel(page, period);

  const validate = page.getByRole("button", { name: "Valider" });
  await validate.waitFor({ state: "visible", timeout: 10000 });
  await validate.click();
  await sleep(1800);
}

/**
 * Choisit un préréglage ou remplit la plage de date personnalisée dans le
 * panneau "Déterminer un préréglage" d'Expérience — partagé entre
 * applyPeriodWithToggle() et setMarketingPeriod(), qui ouvrent ce même
 * panneau par des chemins différents.
 */
async function selectPeriodInPanel(page: Page, period: ScanPeriod): Promise<void> {
  if (period.mode === "preset") {
    const label = PERIOD_PRESETS[period.value];
    if (!label) throw new Error(`Preset de période inconnu : ${period.value}`);

    const preset = page.getByRole("button", { name: label, exact: false });
    await preset.waitFor({ state: "visible", timeout: 10000 });
    await preset.click();
    return;
  }

  await fillCustomDateRange(page, period);
}

/**
 * Période personnalisée — remplit les champs "Début"/"Fin" de la section
 * "Plage de date" du panneau de période Expérience. Jamais vérifié
 * contre le vrai DOM (retours utilisateur du 2026-09-02, capture d'écran
 * uniquement — voir docs/reference/phase-d-notes.md) : l'affichage au
 * format "03 SEP 2023" suggère un widget de saisie personnalisé, pas un
 * <input type="date"> natif. Meilleure hypothèse raisonnable, pas une
 * certitude — à corriger une fois les vrais sélecteurs/format observés
 * en conditions réelles (même méthode que pour le formulaire de
 * connexion, cf. docs/reference/phase-c-real-connection-notes.md).
 * Échoue bruyamment plutôt que d'avaler l'erreur : une période mal
 * appliquée produirait un scan sur la mauvaise plage sans que personne
 * ne s'en aperçoive, pire qu'un échec visible.
 */
async function fillCustomDateRange(page: Page, period: { startDate: string; endDate: string }): Promise<void> {
  const startField = page
    .getByLabel(/^Début$/i)
    .or(page.getByRole("textbox", { name: /Début/i }))
    .or(page.locator("label", { hasText: "Début" }).locator("xpath=following::input[1]"));
  const endField = page
    .getByLabel(/^Fin$/i)
    .or(page.getByRole("textbox", { name: /Fin/i }))
    .or(page.locator("label", { hasText: "Fin" }).locator("xpath=following::input[1]"));

  await startField.first().waitFor({ state: "visible", timeout: 10000 });
  await startField.first().fill(formatExperienceDate(period.startDate));

  await endField.first().waitFor({ state: "visible", timeout: 10000 });
  await endField.first().fill(formatExperienceDate(period.endDate));
}

const EXPERIENCE_MONTH_LABELS = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEP", "OCT", "NOV", "DÉC"];

/** "YYYY-MM-DD" → "03 SEP 2023", format observé sur la capture d'écran du sélecteur Expérience. */
function formatExperienceDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${String(day).padStart(2, "0")} ${EXPERIENCE_MONTH_LABELS[month! - 1]} ${year}`;
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
  const periodControl = page.getByText("Période", { exact: true }).first();
  await periodControl.waitFor({ state: "visible", timeout: 15000 });
  await periodControl.click();

  await selectPeriodInPanel(page, period);

  await page.getByRole("button", { name: "Valider" }).click();
  await sleep(1800);
}
