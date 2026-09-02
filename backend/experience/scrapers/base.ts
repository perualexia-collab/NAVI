import type { Page } from "playwright";
import { parsePercentage } from "./parsing.js";

/** Base exploitable — porté depuis scrapeGeneralKPIs() (bloc 3/8). */
export interface BaseKpis {
  totalProfiles: number;
  emailsProvided: number;
  emailCoverageRate: number | null;
  otaAgencyRate: number | null;
  unsubscribedRate: number | null;
  usableEmails: number;
  activabilityRate: number | null;
}

const BASE_SUMMARY_PATTERN = /([\d\s]+)\s+renseignés\s+sur\s+un\s+total\s+de\s+([\d\s]+)\s+profils?\s+clients?/i;

/**
 * Expérience affiche d'abord ce résumé avec les valeurs non chargées
 * (constaté sur un run réel, 2026-09-02 : le texte lu était littéralement
 * "... un total de undefined profils clients") avant de les remplacer en
 * asynchrone une fois l'appel de données terminé. Attendre que l'élément
 * soit visible ne suffit donc pas — il faut attendre que son texte
 * contienne effectivement des chiffres. Voir
 * docs/reference/phase-c-real-connection-notes.md.
 */
async function readBaseSummary(page: Page): Promise<{ emailsProvided: number; totalProfiles: number }> {
  const summary = page.getByText(/renseignés sur un total/i).first();
  await summary.waitFor({ state: "visible", timeout: 20000 });

  const deadline = Date.now() + 20000;
  let text = "";
  let match: RegExpMatchArray | null = null;
  while (Date.now() < deadline) {
    text = (await summary.innerText()).replace(/ /g, " ");
    match = text.match(BASE_SUMMARY_PATTERN);
    if (match) break;
    await page.waitForTimeout(300);
  }
  if (!match) throw new Error(`Résumé base illisible : ${text}`);

  return {
    emailsProvided: Number(match[1]!.replace(/\s/g, "")),
    totalProfiles: Number(match[2]!.replace(/\s/g, ""))
  };
}

async function readTableRow(page: Page, labelText: string): Promise<string> {
  const label = page.getByRole("cell", { name: labelText, exact: false }).first();
  await label.waitFor({ state: "visible", timeout: 20000 });
  const row = label.locator("xpath=ancestor::tr[1]");
  return row.innerText();
}

export async function scrapeGeneralKPIs(page: Page): Promise<BaseKpis> {
  const { emailsProvided, totalProfiles } = await readBaseSummary(page);

  const emailRow = await readTableRow(page, "Profils avec e-mail renseigné");
  const otaRow = await readTableRow(page, "Profils avec e-mails Agences");
  const unsubRow = await readTableRow(page, "Désinscrits");
  const usableRow = await readTableRow(page, "Profils avec e-mail utilisable");

  const usableEmailsMatch = usableRow.replace(/Profils avec e-mail utilisable/i, "").match(/-?\d+(?:[.,]\d+)?/);
  const usableEmails = usableEmailsMatch ? Number(usableEmailsMatch[0].replace(/\s/g, "").replace(",", ".")) : 0;

  const activabilityRate = totalProfiles > 0 ? (usableEmails / totalProfiles) * 100 : null;

  return {
    totalProfiles,
    emailsProvided,
    emailCoverageRate: parsePercentage(emailRow),
    otaAgencyRate: parsePercentage(otaRow),
    unsubscribedRate: parsePercentage(unsubRow),
    usableEmails,
    activabilityRate: activabilityRate === null ? null : Math.round((activabilityRate + Number.EPSILON) * 100) / 100
  };
}
