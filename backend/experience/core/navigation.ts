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
 * Période personnalisée — champs "Début"/"Fin" de la section "Plage de
 * date" du panneau de période Expérience. Confirmé contre le vrai DOM
 * (retours utilisateur du 2026-09-02, cf. docs/reference/phase-d-notes.md) :
 * ce n'est PAS un champ texte éditable, mais un composant vue-datepicker
 * (`vdp-datepicker`) — l'input est en lecture seule, la date se choisit en
 * cliquant dans un calendrier à 3 niveaux (jour → mois → année, empilés,
 * un seul visible à la fois). Remplace l'ancienne implémentation par
 * saisie de texte, qui ne matchait aucun élément réel (ScanError TIMEOUT
 * confirmé sur "Hôtel Cactus").
 */
async function fillCustomDateRange(page: Page, period: { startDate: string; endDate: string }): Promise<void> {
  await setVdpDate(page, "date-start", period.startDate);
  await setVdpDate(page, "date-end", period.endDate);
}

const FULL_MONTH_NAMES_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre"
];

/**
 * Sélectionne une date dans un widget vue-datepicker (`.vdp-datepicker`).
 * `wrapperClass` distingue le champ "Début" (`date-start`) du champ "Fin"
 * (`date-end`) — les deux widgets coexistent dans le même panneau.
 */
async function setVdpDate(page: Page, wrapperClass: "date-start" | "date-end", isoDate: string): Promise<void> {
  const [year, month, day] = isoDate.split("-").map(Number);
  const wrapper = page.locator(`.vdp-datepicker.${wrapperClass}`).first();
  await wrapper.waitFor({ state: "visible", timeout: 10000 });

  await wrapper.locator("input").first().click();
  await sleep(300);

  // Le calendrier s'ouvre sur la vue jour (mois déjà sélectionné) — on
  // remonte jusqu'à la vue année en cliquant l'en-tête ".up", quelle que
  // soit la vue de départ.
  for (let i = 0; i < 2; i++) {
    const yearCells = wrapper.locator(".vdp-datepicker__calendar:visible .cell.year");
    if (await yearCells.first().isVisible().catch(() => false)) break;
    const upLink = wrapper.locator(".vdp-datepicker__calendar:visible .up");
    await upLink.first().waitFor({ state: "visible", timeout: 5000 });
    await upLink.first().click();
    await sleep(150);
  }

  const yearCell = wrapper.locator(".vdp-datepicker__calendar:visible .cell.year", { hasText: new RegExp(`^${year}$`) });
  await yearCell.first().waitFor({ state: "visible", timeout: 5000 });
  await yearCell.first().click();
  await sleep(150);

  const monthCell = wrapper.locator(".vdp-datepicker__calendar:visible .cell.month", {
    hasText: new RegExp(`^${FULL_MONTH_NAMES_FR[month! - 1]}$`, "i")
  });
  await monthCell.first().waitFor({ state: "visible", timeout: 5000 });
  await monthCell.first().click();
  await sleep(150);

  const dayCell = wrapper.locator(".vdp-datepicker__calendar:visible .cell.day:not(.blank):not(.muted)", {
    hasText: new RegExp(`^${day}$`)
  });
  await dayCell.first().waitFor({ state: "visible", timeout: 5000 });
  await dayCell.first().click();
  await sleep(150);
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
