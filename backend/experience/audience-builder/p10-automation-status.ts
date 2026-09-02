import type { Page } from "playwright";
import { sleep } from "../core/utils.js";

/**
 * P10 — détection des automations marketing actives/inactives, portée à
 * l'identique depuis docs/reference/moteur-experience-existant.js (bloc
 * 6/8 : openAutomationStatusP10, readAutomationDistributionP10,
 * classifyAutomationStatusP10). **La partie la plus fragile du moteur
 * existant** (signalée comme telle par l'audit d'architecture) : Expérience
 * n'expose la colonne "actif/inactif" d'une automation que par sa position
 * visuelle sur l'écran "Activation rapide" (deux colonnes), pas par un
 * attribut DOM — la classification lit donc la position X de chaque texte
 * par rapport aux deux en-têtes de colonne, sans autre ancrage sémantique.
 * Susceptible de casser si Expérience change la mise en page (largeur de
 * fenêtre, responsive, réordonnancement) — à surveiller en priorité si un
 * scan P10 échoue de façon inattendue.
 */

function normalizeTextP10(value: string | null): string {
  return String(value ?? "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompareP10(value: string | null): string {
  return normalizeTextP10(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Campagnes tolérées inactives sans que ça remette en cause le statut ACTIVE — cas particuliers connus du référentiel. */
const ALLOWED_INACTIVE_CAMPAIGNS_P10 = ["Campagne IT/ES/PT: Printemps", "Campagne Tarif Entreprise"];

export async function openAutomationStatusP10(page: Page): Promise<void> {
  const changeSpace = page.getByRole("button", { name: /Changer d'espace/i });
  await changeSpace.waitFor({ state: "visible", timeout: 30000 });
  await changeSpace.click();

  const campaigns = page.getByRole("button", { name: /Campagnes/i });
  await campaigns.waitFor({ state: "visible", timeout: 30000 });
  await campaigns.click();

  const automated = page.getByRole("link", { name: /Marketing automatisé/i });
  await automated.waitFor({ state: "visible", timeout: 30000 });
  await automated.click();

  const quickActivation = page.getByRole("link", { name: /Activation rapide/i });
  await quickActivation.waitFor({ state: "visible", timeout: 30000 });
  await quickActivation.click();

  await sleep(1500);
}

export interface AutomationDistribution {
  active: string[];
  inactive: string[];
}

interface AutomationLeaf {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  childCount: number;
}

const IGNORED_AUTOMATION_LABELS = [
  "Campagnes inactives",
  "Campagnes actives",
  "Activation rapide",
  "Activer",
  "Désactiver",
  "Etat actuel",
  "État actuel",
  "Ressources",
  "Assistance",
  "Feedback",
  "Nouveautés",
  "Modification",
  "Activation en masse"
].map(normalizeCompareP10);

export async function readAutomationDistributionP10(page: Page): Promise<AutomationDistribution> {
  const inactiveHeading = page.getByRole("heading", { name: /Campagnes inactives/i });
  const activeHeading = page.getByRole("heading", { name: /Campagnes actives/i });
  await inactiveHeading.waitFor({ state: "visible", timeout: 30000 });
  await activeHeading.waitFor({ state: "visible", timeout: 30000 });

  const inactiveBox = await inactiveHeading.boundingBox();
  const activeBox = await activeHeading.boundingBox();
  if (!inactiveBox || !activeBox) throw new Error("Colonnes automations introuvables");

  const inactiveCenterX = inactiveBox.x + inactiveBox.width / 2;
  const activeCenterX = activeBox.x + activeBox.width / 2;
  const middleX = (inactiveCenterX + activeCenterX) / 2;
  const minY = Math.max(inactiveBox.y + inactiveBox.height, activeBox.y + activeBox.height);

  const raw: AutomationLeaf[] = await page.locator("a, button, span, p, div").evaluateAll((nodes, data) => {
    return (nodes as HTMLElement[])
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          text: (el.textContent || "").replace(/\s+/g, " ").trim(),
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
          childCount: el.children.length
        };
      })
      .filter((item) => item.text && item.y > data.minY && item.width > 0 && item.height > 0);
  }, { minY });

  const leaves = raw.filter((item) => item.childCount === 0);

  const candidates = leaves.filter((item) => {
    const text = normalizeCompareP10(item.text);
    if (!text) return false;
    if (text.length < 4 || text.length > 160) return false;
    if (IGNORED_AUTOMATION_LABELS.some((ignored) => text === ignored)) return false;
    return true;
  });

  const active: string[] = [];
  const inactive: string[] = [];
  const seen = new Set<string>();

  for (const item of candidates) {
    const column: "active" | "inactive" =
      inactiveCenterX < activeCenterX ? (item.x < middleX ? "inactive" : "active") : item.x < middleX ? "active" : "inactive";

    const normalized = normalizeCompareP10(item.text);
    const key = `${column}::${normalized}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (column === "active") active.push(normalizeTextP10(item.text));
    else inactive.push(normalizeTextP10(item.text));
  }

  return { active, inactive };
}

export type AutomationStatusAction = "MANUAL_CHECK" | "ACTIVATE_AUTOMATIONS" | "FIX_AUTOMATION_CONFIGURATION" | "SEARCH_PUNCTUAL_CAMPAIGN";

export interface AutomationStatus {
  status: "UNKNOWN" | "INACTIVE" | "PARTIAL" | "ACTIVE";
  action: AutomationStatusAction;
  unexpectedInactive: string[];
}

export function classifyAutomationStatusP10(distribution: AutomationDistribution): AutomationStatus {
  const { active, inactive } = distribution;
  const total = active.length + inactive.length;

  if (total === 0) return { status: "UNKNOWN", action: "MANUAL_CHECK", unexpectedInactive: [] };
  if (active.length === 0 && inactive.length > 0) return { status: "INACTIVE", action: "ACTIVATE_AUTOMATIONS", unexpectedInactive: [] };

  const allowed = ALLOWED_INACTIVE_CAMPAIGNS_P10.map(normalizeCompareP10);
  const unexpectedInactive = inactive.filter((name) => !allowed.includes(normalizeCompareP10(name)));

  if (unexpectedInactive.length > 0) return { status: "PARTIAL", action: "FIX_AUTOMATION_CONFIGURATION", unexpectedInactive };

  return { status: "ACTIVE", action: "SEARCH_PUNCTUAL_CAMPAIGN", unexpectedInactive: [] };
}
