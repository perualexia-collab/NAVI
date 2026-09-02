import type { Locator, Page } from "playwright";
import { sleep } from "../core/utils.js";

/**
 * Calendrier des champs de date de l'Audience Builder Expérience — c'est
 * en réalité le **même widget vue-datepicker** que celui du sélecteur de
 * période Reporting (`backend/experience/core/navigation.ts`, corrigé en
 * Phase D avec la même mécanique) : input en lecture seule, calendrier à
 * 3 vues empilées (jour/mois/année), navigable uniquement au clic.
 *
 * Le premier portage de ce fichier (basé sur `selectDateWithCalendar` du
 * script d'origine — flèche "<" pour reculer d'une année, clic sur texte
 * exact) correspondait à une version antérieure d'Expérience : un test
 * réel (Belinda Hôtel & Spa, 2026-09-02) a échoué avec "Header 'Mois
 * Année' du calendrier introuvable" — le vrai DOM (fourni par
 * l'utilisateur) a confirmé qu'il s'agit du même composant vdp-datepicker
 * que Reporting, pas de l'ancien calendrier.
 */

const FULL_MONTH_NAMES_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

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
 * Sélectionne une date dans le calendrier vdp-datepicker associé à
 * `input` (le champ de saisie readonly). `input` peut être n'importe quel
 * des champs de date de l'Audience Builder (une seule instance à la fois,
 * ou l'un des deux champs "Between") — le calendrier associé est retrouvé
 * en remontant au conteneur `.vdp-datepicker` le plus proche.
 *
 * Ne gère pas la pagination de décennie sur la vue année (fenêtre
 * affichée : "2020 - 2029") — toutes les périodes actuellement utilisées
 * (12 à 36 mois dans le passé, ou entre 3 et 18 mois) restent dans cette
 * fenêtre. À revoir si un filtre avec un décalage plus grand est ajouté.
 */
export async function selectDateWithCalendar(page: Page, input: Locator, targetDate: Date): Promise<void> {
  const wrapper = input.locator("xpath=ancestor::div[contains(@class,'vdp-datepicker')][1]");

  await input.click();
  await sleep(300);

  for (let i = 0; i < 2; i++) {
    const yearCells = wrapper.locator(".vdp-datepicker__calendar:visible .cell.year");
    if (await yearCells.first().isVisible().catch(() => false)) break;
    const upLink = wrapper.locator(".vdp-datepicker__calendar:visible .up");
    await upLink.first().waitFor({ state: "visible", timeout: 5000 });
    await upLink.first().click();
    await sleep(150);
  }

  const year = targetDate.getFullYear();
  const yearCell = wrapper.locator(".vdp-datepicker__calendar:visible .cell.year", { hasText: new RegExp(`^${year}$`) });
  await yearCell.first().waitFor({ state: "visible", timeout: 5000 });
  await yearCell.first().click();
  await sleep(150);

  const monthCell = wrapper.locator(".vdp-datepicker__calendar:visible .cell.month", {
    hasText: new RegExp(`^${FULL_MONTH_NAMES_FR[targetDate.getMonth()]}$`, "i")
  });
  await monthCell.first().waitFor({ state: "visible", timeout: 5000 });
  await monthCell.first().click();
  await sleep(150);

  const day = targetDate.getDate();
  const dayCell = wrapper.locator(".vdp-datepicker__calendar:visible .cell.day:not(.blank)", { hasText: new RegExp(`^${day}$`) });
  await dayCell.first().waitFor({ state: "visible", timeout: 5000 });
  await dayCell.first().click();
  await sleep(150);

  const value = await input.inputValue().catch(() => "");
  if (!value) throw new Error(`La date ${formatDateFR(targetDate)} n'a pas été enregistrée.`);
}
