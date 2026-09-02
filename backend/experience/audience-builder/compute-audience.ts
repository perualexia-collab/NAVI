import type { Page } from "playwright";
import type { AudienceDefinitionConfig } from "./definitions.js";
import { openMailingLists, startNewAudience, recalculateResults, selectNaviMode, createTempName, saveTemporaryAudience, reopenTemporaryAudience, readAudienceRecipientCount, deleteAudience } from "./mailing-lists.js";
import { buildAudienceDefinition } from "./filters.js";

export interface AudiencePreviewInput {
  hotelName: string;
  playbookId: string;
  definition: AudienceDefinitionConfig;
  dynamicValues?: Record<string, number>;
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
  const { hotelName, playbookId, definition, dynamicValues = {} } = input;
  let tempName: string | null = null;

  try {
    await openMailingLists(page);
    await startNewAudience(page);
    await buildAudienceDefinition(page, definition, dynamicValues);
    await recalculateResults(page);
    await selectNaviMode(page);

    tempName = createTempName(playbookId, hotelName, definition.id);
    await saveTemporaryAudience(page, tempName);
    await reopenTemporaryAudience(page, tempName);

    const recipients = await readAudienceRecipientCount(page);
    console.log(`[audience-builder] ${definition.name} (${playbookId}, ${hotelName}) : ${recipients} destinataire(s)`);

    await deleteAudience(page, tempName);
    tempName = null;

    return { definitionId: definition.id, name: definition.name, recipients };
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
