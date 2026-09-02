import type { Page } from "playwright";
import { openMailingLists, startNewAudience, recalculateResults, selectNaviMode, createTempName, saveTemporaryAudience, reopenTemporaryAudience, readAudienceRecipientCount, deleteAudience } from "./mailing-lists.js";

export interface AudiencePreviewInput {
  hotelName: string;
  playbookId: string;
  /** Identifiant stable de l'audience (ex. id AudienceDefinition) — sert au nom de liste temporaire et au résultat retourné. */
  audienceId: string;
  audienceName: string;
  /**
   * Construit les filtres dans le panneau Expérience déjà ouvert — via le
   * dispatcher générique `buildAudienceDefinition()` (E2/P11, filtres
   * déclaratifs) ou une fonction dédiée (P10 : plusieurs audiences ne
   * suivent pas le modèle déclaratif — OR, opérateurs IN/NOT IN sur liste,
   * cf. backend/experience/audience-builder/p10-filters.ts).
   */
  buildFilters: (page: Page) => Promise<void>;
}

export interface AudiencePreviewResult {
  definitionId: string;
  name: string;
  recipients: number;
}

/**
 * Cycle complet de calcul d'une audience — porté à l'identique depuis
 * `previewAudience()` (docs/reference/moteur-experience-existant.js, bloc
 * 5/8) : création d'une liste TEMPORAIRE → filtres → recalcul → mode NAVI
 * → sauvegarde → réouverture (pour lire le volume de façon fiable) →
 * lecture → suppression. Ne crée jamais de liste persistante.
 *
 * Filet de sécurité : si une erreur survient après la sauvegarde
 * temporaire, on tente quand même de supprimer la liste avant de
 * propager l'erreur, pour ne jamais laisser de liste NAVI_TEMP_* traîner
 * dans Expérience.
 */
export async function computeAudiencePreview(page: Page, input: AudiencePreviewInput): Promise<AudiencePreviewResult> {
  const { hotelName, playbookId, audienceId, audienceName, buildFilters } = input;
  let tempName: string | null = null;

  try {
    await openMailingLists(page);
    await startNewAudience(page);
    await buildFilters(page);
    await recalculateResults(page);
    await selectNaviMode(page);

    tempName = createTempName(playbookId, hotelName, audienceId);
    await saveTemporaryAudience(page, tempName);
    await reopenTemporaryAudience(page, tempName);

    const recipients = await readAudienceRecipientCount(page);
    console.log(`[audience-builder] ${audienceName} (${playbookId}, ${hotelName}) : ${recipients} destinataire(s)`);

    await deleteAudience(page, tempName);
    tempName = null;

    return { definitionId: audienceId, name: audienceName, recipients };
  } catch (error) {
    if (tempName) {
      try {
        await deleteAudience(page, tempName);
      } catch (cleanupError) {
        console.error(`[audience-builder] Nettoyage de sécurité impossible pour ${tempName} :`, cleanupError);
      }
    }
    throw error;
  }
}
