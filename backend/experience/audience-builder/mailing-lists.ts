import type { Locator, Page } from "playwright";
import { sleep } from "../core/utils.js";

/**
 * Listes d'envoi / cycle de vie d'une audience temporaire — porté à
 * l'identique depuis docs/reference/moteur-experience-existant.js (bloc
 * 4/8 pour l'ouverture/navigation, bloc 5/8 pour la sauvegarde temporaire,
 * la lecture du volume et la suppression). `readAudienceRecipientCount`
 * correspond à `getNaviRecipientsCount` dans le script d'origine — renommé
 * pour le vocabulaire générique du brief §5 (`readAudienceCount`).
 */

export async function openMailingLists(page: Page): Promise<void> {
  const existingLink = page.getByRole("link", { name: /Listes d'envoi/i });
  if (await existingLink.first().isVisible().catch(() => false)) {
    await existingLink.first().click();
    await sleep(1200);
    return;
  }

  const changeSpace = page.getByRole("button", { name: /Changer d'espace/i });
  await changeSpace.waitFor({ state: "visible", timeout: 20000 });
  await changeSpace.click();
  await sleep(400);

  const campaigns = page.getByRole("button", { name: /Campagnes/i });
  await campaigns.waitFor({ state: "visible", timeout: 20000 });
  await campaigns.click();
  await sleep(500);

  const lists = page.getByRole("link", { name: /Listes d'envoi/i });
  await lists.waitFor({ state: "visible", timeout: 20000 });
  await lists.click();
  await sleep(1000);
}

export async function startNewAudience(page: Page): Promise<void> {
  const newList = page.getByRole("link", { name: /Nouvelle liste/ });
  await newList.waitFor({ state: "visible", timeout: 20000 });
  await newList.click();
  await sleep(500);

  const fromBase = page.getByRole("link", { name: /A partir de ma base clients/i });
  await fromBase.waitFor({ state: "visible", timeout: 20000 });
  await fromBase.click();
  await sleep(800);
}

async function returnToMailingLists(page: Page): Promise<void> {
  const back = page.getByRole("link", { name: /Retour aux listes d'envoi/i }).first();
  if (await back.isVisible().catch(() => false)) {
    await back.click();
    await sleep(1000);
    return;
  }
  await openMailingLists(page);
}

export async function recalculateResults(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: /Recalculer les résultats/i });
  await button.waitFor({ state: "visible", timeout: 20000 });
  await button.click();

  const exclusion = page.getByText(/Exclure les clients ayant une réservation future ou présents dans l'établissement/i).first();
  await exclusion.waitFor({ state: "visible", timeout: 30000 });
  await sleep(1000);
}

/** Source de vérité NAVI pour le volume : exclure les clients avec réservation future / présents à l'hôtel. */
export async function selectNaviMode(page: Page): Promise<void> {
  const exclusion = page.getByText(/Exclure les clients ayant une réservation future ou présents dans l'établissement/i).first();
  await exclusion.waitFor({ state: "visible", timeout: 20000 });
  await exclusion.click();
  await sleep(400);
}

function normalizeName(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();
}

/** Nom de liste temporaire — playbook + audience + hôtel + horodatage, pour être identifiable et jamais confondu avec une vraie liste. */
export function createTempName(playbookId: string, hotelName = "", audienceId = ""): string {
  const now = new Date();
  const timestamp =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    "_" +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");

  return ["NAVI_TEMP", playbookId, audienceId, normalizeName(hotelName), timestamp].filter(Boolean).join("_");
}

export async function saveTemporaryAudience(page: Page, tempName: string): Promise<void> {
  const nameInput = page.getByRole("textbox", { name: "Nom de la liste" });
  await nameInput.waitFor({ state: "visible", timeout: 20000 });
  await nameInput.fill(tempName);

  const saveButton = page.getByRole("button", { name: "Enregistrer" });
  await saveButton.waitFor({ state: "visible", timeout: 20000 });
  await saveButton.click();
  await sleep(1600);
}

export async function reopenTemporaryAudience(page: Page, tempName: string): Promise<void> {
  let modify = page.getByRole("link", { name: "Modifier", exact: true });
  if (await modify.isVisible().catch(() => false)) {
    await modify.click();
    await sleep(1000);
    return;
  }

  await returnToMailingLists(page);

  const exactLink = page.getByRole("link", { name: tempName, exact: true });
  if (await exactLink.isVisible().catch(() => false)) {
    await exactLink.click();
  } else {
    const row = page.getByRole("row").filter({ hasText: tempName }).first();
    await row.waitFor({ state: "visible", timeout: 20000 });

    const links = row.getByRole("link");
    if ((await links.count()) === 0) throw new Error("Liste temporaire retrouvée mais aucun lien disponible.");
    await links.first().click();
  }

  await sleep(800);

  modify = page.getByRole("link", { name: "Modifier", exact: true });
  await modify.waitFor({ state: "visible", timeout: 20000 });
  await modify.click();
  await sleep(1000);
}

/**
 * Cherche, en remontant les parents DOM depuis `anchor`, le premier
 * ancêtre ne contenant qu'un seul heading numérique — c'est ce heading
 * qui porte le volume affiché juste à côté du libellé "Destinataire(s)".
 */
async function extractNumericHeadingFromAnchor(anchor: Locator): Promise<{ success: boolean; value?: number }> {
  // Pas de fonction imbriquée nommée ici : le callback est sérialisé et
  // réévalué tel quel dans le navigateur par Playwright — un helper
  // esbuild (__name, injecté par tsx pour les fonctions nommées) n'y
  // existe pas et fait planter l'évaluation (constaté en conditions
  // réelles, cf. docs/reference/phase-e-notes.md).
  return anchor.evaluate((element) => {
    let parent: Element | null = element;
    for (let level = 0; level < 12; level++) {
      parent = parent.parentElement;
      if (!parent) break;

      const headings = Array.from(parent.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]'));
      const numbers: number[] = [];
      for (const heading of headings) {
        const clean = String(heading.textContent ?? "")
          .replace(/\u00A0/g, "")
          .replace(/\s+/g, "")
          .trim();
        if (/^\d+$/.test(clean)) numbers.push(Number(clean));
      }

      if (numbers.length === 1) return { success: true, value: numbers[0] };
    }

    return { success: false };
  });
}

/**
 * Lit le volume réel de l'audience NAVI (0 destinataire est un résultat
 * valide, pas une erreur). Deux méthodes, dans l'ordre validé
 * historiquement : le 2e libellé "Destinataire(s)" (validé P07), sinon
 * lecture directe depuis la carte NAVI (fallback validé P02/P09/P11).
 */
export async function readAudienceRecipientCount(page: Page): Promise<number> {
  const title = page.getByRole("heading", { name: /Résultat de la segmentation/i });
  await title.waitFor({ state: "visible", timeout: 30000 });

  const naviLabel = page.getByText(/Exclure les clients ayant une réservation future ou présents dans l'établissement/i).first();
  await naviLabel.waitFor({ state: "visible", timeout: 30000 });

  const recipientLabels = page.getByText(/^Destinataire(?:s)?$/i);
  const recipientCount = await recipientLabels.count();

  if (recipientCount >= 2) {
    const result = await extractNumericHeadingFromAnchor(recipientLabels.nth(1));
    if (result.success) return Number(result.value);
  }

  const fallback = await extractNumericHeadingFromAnchor(naviLabel);
  if (fallback.success) return Number(fallback.value);

  throw new Error("Impossible de lire le volume de l'audience NAVI.");
}

export async function deleteAudience(page: Page, listName: string): Promise<void> {
  await returnToMailingLists(page);

  const row = page.getByRole("row").filter({ hasText: listName }).first();
  await row.waitFor({ state: "visible", timeout: 20000 });

  const buttons = row.getByRole("button");
  const buttonCount = await buttons.count();
  if (buttonCount === 0) throw new Error(`Bouton d'action introuvable pour ${listName}.`);
  await buttons.first().click();
  await sleep(300);

  const deleteButton = page.getByRole("button", { name: /Supprimer/i });
  await deleteButton.waitFor({ state: "visible", timeout: 10000 });
  await deleteButton.click();
  await sleep(300);

  const confirmButton = page.getByRole("button", { name: "Oui", exact: true });
  await confirmButton.waitFor({ state: "visible", timeout: 10000 });
  await confirmButton.click();
  await sleep(1000);
}
