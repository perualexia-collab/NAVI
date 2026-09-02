import type { Page } from "playwright";
import { sleep } from "../core/utils.js";
import { addAndCondition, addOrCondition, addStayAmountFilter, addStayCountFilter, selectListOperator, selectListValue } from "./filters.js";

/**
 * Filtres spécifiques aux 9 audiences P10 (bibliothèque de campagnes) qui
 * n'existaient pas déjà pour P02…P09/P11 — porté à l'identique depuis
 * docs/reference/moteur-experience-existant.js (bloc 5/8) :
 * addNationalAudienceFilter, addLeisureAudienceFilter, addCoupleFilter,
 * addBusinessFilter, addFrequentDestinationFilter, addCouplesLeisureFilter.
 * Repeaters/One-timers/Clients à forte valeur réutilisent
 * `addStayCountFilter`/`addStayAmountFilter` (filters.ts) — mêmes champs
 * qu'ailleurs, pas besoin de les recopier.
 */

export async function addNationalAudienceFilter(page: Page): Promise<void> {
  await addAndCondition(page, true);

  const search = page.getByRole("textbox", { name: "Rechercher" });
  await search.fill("pays");
  await sleep(300);

  await page.getByRole("link", { name: /Pays du client/i }).click();
  await sleep(350);

  await selectListOperator(page, "In");
  await selectListValue(page, "France");

  await page.getByRole("button", { name: "Valider" }).click();
  await sleep(450);
}

export async function addLeisureAudienceFilter(page: Page): Promise<void> {
  await addAndCondition(page, true);

  const search = page.getByRole("textbox", { name: "Rechercher" });
  await search.fill("raison");
  await sleep(300);

  await page.getByRole("link", { name: /Raison de la visite/i }).click();
  await sleep(350);

  await selectListOperator(page, "NotIn");
  await selectListValue(page, "Pour un salon ou un séminaire");
  await selectListValue(page, "Voyage d'affaires");

  await page.getByRole("button", { name: "Valider" }).click();
  await sleep(450);
}

export async function addBusinessFilter(page: Page): Promise<void> {
  await addAndCondition(page, true);

  const search = page.getByRole("textbox", { name: "Rechercher" });
  await search.fill("raison");
  await sleep(300);

  await page.getByRole("link", { name: /Raison de la visite/i }).click();
  await sleep(350);

  await selectListOperator(page, "In");
  await selectListValue(page, "Pour un salon ou un séminaire");
  await selectListValue(page, "Voyage d'affaires");

  await page.getByRole("button", { name: "Valider" }).click();
  await sleep(450);
}

export async function addFrequentDestinationFilter(page: Page): Promise<void> {
  await addAndCondition(page, true);

  const search = page.getByRole("textbox", { name: "Rechercher" });
  await search.fill("vient souvent");
  await sleep(300);

  const field = page.getByRole("link", { name: /Vient souvent dans la ville\/r/i });
  await field.waitFor({ state: "visible", timeout: 15000 });
  await field.click();
  await sleep(350);

  await selectListValue(page, "oui");

  await page.getByRole("button", { name: "Valider" }).click();
  await sleep(450);
}

/** Segment visiteur = En couple OU Raison de la visite = Voyage de noces. */
export async function addCoupleFilter(page: Page): Promise<void> {
  await addAndCondition(page, true);

  let search = page.getByRole("textbox", { name: "Rechercher" });
  await search.fill("segment");
  await sleep(300);

  await page.getByRole("link", { name: /Segment visiteur/i }).click();
  await sleep(350);

  await selectListOperator(page, "In");
  await selectListValue(page, "En couple");

  await page.getByRole("button", { name: "Valider" }).click();
  await sleep(500);

  await addOrCondition(page);

  search = page.getByRole("textbox", { name: "Rechercher" });
  await search.fill("raison");
  await sleep(300);

  await page.getByRole("link", { name: /Raison de la visite/i }).click();
  await sleep(350);

  await selectListOperator(page, "In");
  await selectListValue(page, "Voyage de noces");

  await page.getByRole("button", { name: "Valider" }).click();
  await sleep(500);
}

/**
 * Segment visiteur = En couple OU Raison de la visite NOT IN [business] —
 * un vrai OU, PAS l'ajout séparé de "Voyage de noces" (contrairement à
 * addCoupleFilter ci-dessus).
 */
export async function addCouplesLeisureFilter(page: Page): Promise<void> {
  await addAndCondition(page, true);

  let search = page.getByRole("textbox", { name: "Rechercher" });
  await search.fill("segment");
  await sleep(300);

  await page.getByRole("link", { name: /Segment visiteur/i }).click();
  await sleep(350);

  await selectListOperator(page, "In");
  await selectListValue(page, "En couple");

  await page.getByRole("button", { name: "Valider" }).click();
  await sleep(500);

  await addOrCondition(page);

  search = page.getByRole("textbox", { name: "Rechercher" });
  await search.fill("raison");
  await sleep(300);

  await page.getByRole("link", { name: /Raison de la visite/i }).click();
  await sleep(350);

  await selectListOperator(page, "NotIn");
  await selectListValue(page, "Pour un salon ou un séminaire");
  await selectListValue(page, "Voyage d'affaires");

  await page.getByRole("button", { name: "Valider" }).click();
  await sleep(500);
}

/**
 * Dispatche vers le builder correspondant au tag d'audience d'une
 * campagne P10 (`P10_LIBRARY`, backend/experience/audience-builder/p10-campaigns.ts).
 * Repeaters/One-timers/Clients à forte valeur réutilisent les builders
 * génériques (mêmes champs qu'ailleurs) ; les 6 autres suivent une
 * mécanique propre (liste multi-valeurs, OR) portée ci-dessus.
 */
export async function buildP10AudienceFilter(page: Page, audienceTag: string, averageSpend?: number): Promise<void> {
  switch (audienceTag) {
    case "Repeaters":
      return addStayCountFilter(page, ">=", 2, true);
    case "One-timers":
      return addStayCountFilter(page, "=", 1, true);
    case "Clients à forte valeur":
      if (averageSpend === undefined || !Number.isFinite(averageSpend)) throw new Error("Dépense moyenne par réservation manquante.");
      return addStayAmountFilter(page, ">=", averageSpend, true);
    case "Clientèle nationale":
      return addNationalAudienceFilter(page);
    case "Loisirs":
      return addLeisureAudienceFilter(page);
    case "Couples":
      return addCoupleFilter(page);
    case "Business":
      return addBusinessFilter(page);
    case "Vient souvent dans la région/ville":
      return addFrequentDestinationFilter(page);
    case "Couples + Loisirs":
      return addCouplesLeisureFilter(page);
    default:
      throw new Error(`Audience P10 inconnue : ${audienceTag}`);
  }
}
