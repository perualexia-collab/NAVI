import type { Locator, Page } from "playwright";
import { sleep } from "../core/utils.js";

/**
 * Calendrier de l'Audience Builder Expérience — porté à l'identique depuis
 * docs/reference/moteur-experience-existant.js (bloc 4/8). Distinct du
 * vue-datepicker du sélecteur de période Reporting
 * (backend/experience/core/navigation.ts) : ici, un input ouvre un
 * calendrier "mois/année" avec une flèche "<" pour reculer d'une année à
 * la fois, puis un clic sur le mois puis le jour en texte exact.
 */

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export function getDateMonthsAgo(months: number): Date {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() - months, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(today.getDate(), maxDay));
  return target;
}

export function formatDateFR(date: Date): string {
  return [String(date.getDate()).padStart(2, "0"), String(date.getMonth() + 1).padStart(2, "0"), date.getFullYear()].join("/");
}

/**
 * Clique le texte exact visible le plus petit (résout la superposition de
 * cellules déjà rencontrée dans ce calendrier — cf. commentaire d'origine).
 */
async function clickVisibleExactText(page: Page, text: string, debugName = text): Promise<void> {
  const locator = page.getByText(String(text), { exact: true });
  const count = await locator.count();

  const candidates: { locator: Locator; box: { width: number; height: number } }[] = [];
  for (let i = 0; i < count; i++) {
    const current = locator.nth(i);
    if (!(await current.isVisible().catch(() => false))) continue;
    const box = await current.boundingBox().catch(() => null);
    if (box) candidates.push({ locator: current, box });
  }

  if (candidates.length === 0) throw new Error(`${debugName} introuvable.`);

  candidates.sort((a, b) => a.box.width * a.box.height - b.box.width * b.box.height);

  for (const candidate of candidates) {
    try {
      await candidate.locator.click({ timeout: 2000 });
      return;
    } catch {
      // Essaie le candidat suivant.
    }
  }

  throw new Error(`${debugName} non cliquable.`);
}

async function clickPreviousYear(page: Page): Promise<void> {
  const arrows = page.getByText("<", { exact: true });
  const count = await arrows.count();

  if (count > 1) {
    const preferredArrow = arrows.nth(1);
    if (await preferredArrow.isVisible().catch(() => false)) {
      await preferredArrow.click();
      await sleep(250);
      return;
    }
  }

  for (let i = 0; i < count; i++) {
    const arrow = arrows.nth(i);
    if (await arrow.isVisible().catch(() => false)) {
      await arrow.click();
      await sleep(250);
      return;
    }
  }

  throw new Error("Flèche année précédente introuvable.");
}

export async function selectDateWithCalendar(page: Page, input: Locator, targetDate: Date): Promise<void> {
  const targetDay = String(targetDate.getDate());
  const targetMonth = MONTHS_FR[targetDate.getMonth()];
  const targetYear = targetDate.getFullYear();

  const now = new Date();
  const currentMonth = MONTHS_FR[now.getMonth()];
  const currentYear = now.getFullYear();

  await input.click();
  await sleep(400);

  const expectedHeader = `${currentMonth} ${currentYear}`;
  const exactHeader = page.getByText(expectedHeader, { exact: true });

  if (await exactHeader.isVisible().catch(() => false)) {
    await exactHeader.click();
  } else {
    const monthYearHeader = page.locator("body *").filter({ hasText: /^(Janvier|Février|Mars|Avril|Mai|Juin|Juillet|Août|Septembre|Octobre|Novembre|Décembre)\s+\d{4}$/ });
    const headerCount = await monthYearHeader.count();
    let clicked = false;
    for (let i = 0; i < headerCount; i++) {
      const candidate = monthYearHeader.nth(i);
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) throw new Error('Header "Mois Année" du calendrier introuvable.');
  }

  await sleep(400);

  const yearsBack = currentYear - targetYear;
  for (let i = 0; i < yearsBack; i++) {
    await clickPreviousYear(page);
  }

  await clickVisibleExactText(page, targetMonth!, `Mois ${targetMonth}`);
  await sleep(350);

  await clickVisibleExactText(page, targetDay, `Jour ${targetDay}`);
  await sleep(450);

  const value = await input.inputValue().catch(() => "");
  if (!value) throw new Error(`La date ${formatDateFR(targetDate)} n'a pas été enregistrée.`);
}
