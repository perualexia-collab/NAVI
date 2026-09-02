import type { Page } from "playwright";
import { sleep } from "../core/utils.js";
import { getDateMonthsAgo, selectDateWithCalendar } from "./calendar.js";
import type { AudienceDefinitionConfig } from "./definitions.js";

/**
 * Construction des filtres de l'Audience Builder Expérience — porté à
 * l'identique depuis docs/reference/moteur-experience-existant.js (bloc
 * 4/8 pour les briques génériques, bloc 5/8 pour `emailNotOpenedSince` et
 * `stayAmount`, spécifiques à P02/P03/P04 et P09).
 */

/**
 * Ajoute une condition "ET" — la 1ère condition est la 4e zone "Ajouter
 * une condition" de l'écran de segmentation (mécanique validée par
 * codegen, ne pas généraliser), les suivantes passent par le titre
 * "Ajouter une condition".
 */
export async function addAndCondition(page: Page, isFirstCondition: boolean): Promise<void> {
  if (isFirstCondition) {
    const zones = page.locator("div").filter({ hasText: /^Ajouter une condition$/ });
    const count = await zones.count();
    if (count < 4) throw new Error(`Seulement ${count} zone(s) "Ajouter une condition" trouvée(s).`);
    await zones.nth(3).click();
  } else {
    const addCondition = page.getByRole("heading", { name: "Ajouter une condition" }).first();
    await addCondition.waitFor({ state: "visible", timeout: 20000 });
    await addCondition.click();
  }
  await sleep(350);
}

export async function addStayCountFilter(page: Page, operator: "=" | ">=", value: number, isFirstCondition: boolean): Promise<void> {
  await addAndCondition(page, isFirstCondition);

  const search = page.getByRole("textbox", { name: "Rechercher" });
  await search.fill("nombre");
  await sleep(300);

  await page.getByRole("link", { name: "Nombre de réservations total" }).click();
  await sleep(250);

  const experienceOperator = operator === "=" ? "Equal" : operator === ">=" ? "GreaterThanOrEqual" : null;
  if (!experienceOperator) throw new Error(`Opérateur Nombre de séjours non supporté : ${operator}`);

  await page.locator("#app").getByRole("combobox").selectOption(experienceOperator);
  await page.getByRole("spinbutton").fill(String(value));
  await page.getByRole("button", { name: "Valider" }).click();
  await sleep(450);
}

async function addLastStayAfterFilter(page: Page, months: number, isFirstCondition: boolean): Promise<void> {
  const targetDate = getDateMonthsAgo(months);

  await addAndCondition(page, isFirstCondition);

  await page.getByRole("link", { name: "Date de départ", exact: true }).click();
  await sleep(250);

  await page.locator("#app").getByRole("combobox").selectOption("GreaterThanOrEqual");
  await sleep(250);

  const input = page.getByRole("textbox").nth(4);
  await selectDateWithCalendar(page, input, targetDate);

  await page.getByRole("button", { name: "Valider" }).click();
  await sleep(450);
}

async function addLastStayBetweenFilter(page: Page, monthsFrom: number, monthsTo: number, isFirstCondition: boolean): Promise<void> {
  const dateFrom = getDateMonthsAgo(monthsFrom);
  const dateTo = getDateMonthsAgo(monthsTo);

  await addAndCondition(page, isFirstCondition);

  await page.getByRole("link", { name: "Date de départ", exact: true }).click();
  await sleep(250);

  await page.locator("#app").getByRole("combobox").selectOption("Between");
  await sleep(250);

  const textboxes = page.getByRole("textbox");
  const input1 = textboxes.nth(4);
  const input2 = textboxes.nth(5);

  await selectDateWithCalendar(page, input1, dateFrom);
  await selectDateWithCalendar(page, input2, dateTo);

  const validateButton = page.getByRole("button", { name: "Valider" });
  await validateButton.waitFor({ state: "visible", timeout: 20000 });
  await validateButton.click();
  await sleep(500);
}

/**
 * Canal de la dernière réservation — les libellés Booking/Expedia varient
 * d'un hôtel à l'autre dans Expérience. NAVI ne dépend donc pas d'une
 * liste fixe : il cherche "book"/"expe" dans les options réellement
 * proposées et sélectionne tout ce qui contient BOOKING ou EXPEDIA.
 */
async function addLastStayChannelFilter(page: Page, isFirstCondition: boolean): Promise<void> {
  await addAndCondition(page, isFirstCondition);

  const search = page.getByRole("textbox", { name: "Rechercher" });
  await search.fill("cana");
  await sleep(300);

  await page.getByRole("link", { name: "Canal de la dernière réservation" }).click();
  await sleep(400);

  const searchboxes = page.getByRole("searchbox");
  const searchboxCount = await searchboxes.count();
  let channelSearch = null;
  for (let i = searchboxCount - 1; i >= 0; i--) {
    const candidate = searchboxes.nth(i);
    if (await candidate.isVisible().catch(() => false)) {
      channelSearch = candidate;
      break;
    }
  }
  if (!channelSearch) throw new Error("Champ de recherche des canaux introuvable.");

  const normalizeChannel = (value: string | null) =>
    String(value ?? "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();

  const discovered = new Map<string, string>();
  for (const searchValue of ["book", "expe"]) {
    await channelSearch.fill(searchValue);
    await sleep(350);

    const options = page.getByRole("option");
    const optionCount = await options.count();
    for (let i = 0; i < optionCount; i++) {
      const option = options.nth(i);
      if (!(await option.isVisible().catch(() => false))) continue;
      const rawLabel = await option.innerText().catch(() => "");
      const normalized = normalizeChannel(rawLabel);
      if (normalized.includes("BOOKING") || normalized.includes("EXPEDIA")) {
        discovered.set(normalized, rawLabel.trim());
      }
    }
  }

  const otaChannels = [...discovered.values()];
  if (otaChannels.length === 0) throw new Error("Aucun canal Booking / Expedia détecté dans Expérience pour cet hôtel.");

  for (const channel of otaChannels) {
    const searchValue = normalizeChannel(channel).includes("EXPEDIA") ? "expe" : "book";
    await channelSearch.fill(searchValue);
    await sleep(250);

    const options = page.getByRole("option");
    const optionCount = await options.count();
    let clicked = false;
    for (let i = 0; i < optionCount; i++) {
      const option = options.nth(i);
      if (!(await option.isVisible().catch(() => false))) continue;
      const optionLabel = await option.innerText().catch(() => "");
      if (normalizeChannel(optionLabel) === normalizeChannel(channel)) {
        await option.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) throw new Error(`Canal OTA détecté mais impossible à sélectionner : ${channel}`);
  }

  await page.getByRole("button", { name: "Valider" }).click();
  await sleep(500);
}

/** P02/P03/P04 — n'a pas ouvert d'e-mail depuis X mois (mécanique validée par codegen, cf. commentaire d'origine). */
async function addEmailNotOpenedSinceFilter(page: Page, months: number, isFirstCondition: boolean): Promise<void> {
  await addAndCondition(page, isFirstCondition);

  const search = page.getByRole("textbox", { name: "Rechercher" });
  await search.waitFor({ state: "visible", timeout: 20000 });
  await search.fill("n'a");
  await sleep(300);

  const filterLink = page.getByRole("link", { name: "N'a pas ouvert d'e-mail" });
  await filterLink.waitFor({ state: "visible", timeout: 20000 });
  await filterLink.click();
  await sleep(300);

  const textboxes = page.getByRole("textbox");
  const count = await textboxes.count();
  if (count < 5) throw new Error(`Champ nombre de mois introuvable : seulement ${count} textbox(s).`);

  const monthsInput = textboxes.nth(4);
  await monthsInput.click();
  await monthsInput.fill(String(months));

  const value = await monthsInput.inputValue().catch(() => "");
  if (value !== String(months)) throw new Error(`Valeur du filtre e-mail incorrecte : "${value}".`);

  const validate = page.getByRole("button", { name: "Valider" });
  await validate.waitFor({ state: "visible", timeout: 20000 });
  await validate.click();
  await sleep(500);
}

/** P09 — montant de réservation >= dépense moyenne par réservation (valeur dynamique, cf. average-spend.ts). */
export async function addStayAmountFilter(page: Page, operator: "=" | ">=", value: number, isFirstCondition: boolean): Promise<void> {
  if (!Number.isFinite(value)) throw new Error(`Montant de la réservation invalide : ${value}`);

  await addAndCondition(page, isFirstCondition);

  const search = page.getByRole("textbox", { name: "Rechercher" });
  await search.fill("mont");
  await sleep(300);

  const field = page.getByRole("link", { name: /Montant de la réservation/i });
  await field.waitFor({ state: "visible", timeout: 15000 });
  await field.click();
  await sleep(250);

  const experienceOperator = operator === ">=" ? "GreaterThanOrEqual" : operator === "=" ? "Equal" : null;
  if (!experienceOperator) throw new Error(`Opérateur montant non supporté : ${operator}`);

  await page.locator("#app").getByRole("combobox").selectOption(experienceOperator);
  await page.getByRole("spinbutton").fill(String(value));

  await page.getByRole("button", { name: "Valider" }).click();
  await sleep(450);
}

/**
 * Sélectionne une valeur dans un champ de filtre à liste (multi-select ou
 * simple) — porté à l'identique depuis `selectListValue()` (bloc 5/8).
 * Essaie dans l'ordre : option déjà visible, ouverture d'un combobox non
 * natif, recherche via un champ de recherche, puis un fallback en texte
 * exact — l'interface Expérience varie selon le champ (liste déroulante
 * simple, multi-select avec recherche, etc.), d'où les paliers successifs.
 */
export async function selectListValue(page: Page, value: string): Promise<void> {
  let option = page.getByRole("option", { name: value, exact: true });
  if (await option.isVisible().catch(() => false)) {
    await option.click();
    return;
  }

  const comboboxes = page.getByRole("combobox");
  const comboCount = await comboboxes.count();
  for (let i = comboCount - 1; i >= 0; i--) {
    const combo = comboboxes.nth(i);
    if (!(await combo.isVisible().catch(() => false))) continue;

    const tagName = await combo.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");
    if (tagName === "select") continue;

    await combo.click().catch(() => {});
    await sleep(300);

    option = page.getByRole("option", { name: value, exact: true });
    if (await option.isVisible().catch(() => false)) {
      await option.click();
      return;
    }
  }

  const searchboxes = page.getByRole("searchbox");
  const searchCount = await searchboxes.count();
  for (let i = searchCount - 1; i >= 0; i--) {
    const search = searchboxes.nth(i);
    if (!(await search.isVisible().catch(() => false))) continue;

    await search.fill(value).catch(() => null);
    await sleep(400);

    option = page.getByRole("option", { name: value, exact: true });
    if (await option.isVisible().catch(() => false)) {
      await option.click();
      return;
    }
  }

  const exactText = page.getByText(value, { exact: true });
  const textCount = await exactText.count();
  for (let i = 0; i < textCount; i++) {
    const candidate = exactText.nth(i);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return;
    }
  }

  throw new Error(`Impossible de sélectionner "${value}".`);
}

/** Sélectionne l'opérateur d'un filtre à liste (In/NotIn) — cherche le premier <select> visible qui accepte cette valeur d'option. */
export async function selectListOperator(page: Page, operatorValue: "In" | "NotIn"): Promise<void> {
  const combos = page.getByRole("combobox");
  const count = await combos.count();

  for (let i = 0; i < count; i++) {
    const combo = combos.nth(i);
    if (!(await combo.isVisible().catch(() => false))) continue;

    const tagName = await combo.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");
    if (tagName !== "select") continue;

    const values = await combo
      .locator("option")
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value))
      .catch(() => [] as string[]);

    if (values.includes(operatorValue)) {
      await combo.selectOption(operatorValue);
      await sleep(250);
      return;
    }
  }

  throw new Error(`Opérateur ${operatorValue} introuvable.`);
}

/** Ouvre une zone "OU" — combine la condition précédente avec la suivante en OR plutôt qu'en AND. */
export async function addOrCondition(page: Page): Promise<void> {
  const zones = page.locator("div").filter({ hasText: /^Ajouter une condition$/ });
  const count = await zones.count();
  if (count < 1) throw new Error('Zone OR "Ajouter une condition" introuvable.');
  await zones.last().click();
  await sleep(350);
}

/**
 * Construit une audience complète dans Expérience à partir d'une
 * définition — dispatche chaque filtre vers le builder correspondant.
 */
export async function buildAudienceDefinition(page: Page, definition: AudienceDefinitionConfig, dynamicValues: Record<string, number> = {}): Promise<void> {
  let firstCondition = true;

  for (const filter of definition.filters) {
    if (filter.field === "stayCount") {
      await addStayCountFilter(page, filter.operator, filter.value, firstCondition);
    } else if (filter.field === "lastStayChannel") {
      await addLastStayChannelFilter(page, firstCondition);
    } else if (filter.field === "lastStayDate" && filter.operator === ">=") {
      await addLastStayAfterFilter(page, filter.relativeMonths, firstCondition);
    } else if (filter.field === "lastStayDate" && filter.operator === "between") {
      await addLastStayBetweenFilter(page, filter.relativeMonthsFrom, filter.relativeMonthsTo, firstCondition);
    } else if (filter.field === "emailNotOpenedSince") {
      await addEmailNotOpenedSinceFilter(page, filter.relativeMonths, firstCondition);
    } else if (filter.field === "stayAmount") {
      const value = filter.dynamicValue ? dynamicValues[filter.dynamicValue] : filter.value;
      if (value === undefined) throw new Error(`Valeur dynamique manquante pour le filtre montant : ${filter.dynamicValue}`);
      await addStayAmountFilter(page, filter.operator, value, firstCondition);
    } else {
      throw new Error(`Filtre Audience Builder non pris en charge : ${JSON.stringify(filter)}`);
    }

    firstCondition = false;
  }
}
