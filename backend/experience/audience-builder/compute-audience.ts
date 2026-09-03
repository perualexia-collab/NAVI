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
  /**
   * Phase F1 — si fourni, la liste est enregistrée sous ce nom et **n'est
   * pas supprimée** à la fin : ce n'est plus un aperçu temporaire mais une
   * vraie liste d'envoi, utilisable telle quelle par l'équipe marketing
   * dans Expérience (cf. backend/scans/run-create-audience-list.ts).
   */
  persistAs?: string;
}

export interface AudiencePreviewResult {
  definitionId: string;
  name: string;
  recipients: number;
  /** Rempli uniquement quand `persistAs` était fourni — nom réel de la liste conservée dans Expérience. */
  listName: string | null;
}

/**
 * Cycle complet de calcul d'une audience — porté à l'identique depuis
 * `previewAudience()` (docs/reference/moteur-experience-existant.js, bloc
 * 5/8) : création d'une liste → filtres → recalcul → mode NAVI →
 * sauvegarde → réouverture (pour lire le volume de façon fiable) →
 * lecture → suppression. Par défaut la liste est temporaire et toujours
 * supprimée ; avec `persistAs` (Phase F1), elle est conservée.
 *
 * Filet de sécurité (aperçu temporaire uniquement) : si une erreur
 * survient après la sauvegarde, on tente quand même de supprimer la
 * liste avant de propager l'erreur, pour ne jamais laisser de liste
 * NAVI_TEMP_* traîner dans Expérience. Ne s'applique pas en mode
 * `persistAs` — une liste volontairement conservée n'est jamais
 * supprimée automatiquement, même en cas d'erreur après la sauvegarde.
 */
export async function computeAudiencePreview(page: Page, input: AudiencePreviewInput): Promise<AudiencePreviewResult> {
  const { hotelName, playbookId, audienceId, audienceName, buildFilters, persistAs } = input;
  let tempName: string | null = null;

  try {
    await openMailingLists(page);
    await startNewAudience(page);
    await buildFilters(page);
    await recalculateResults(page);
    await selectNaviMode(page);

    tempName = persistAs ?? createTempName(playbookId, hotelName, audienceId);
    await saveTemporaryAudience(page, tempName);
    await reopenTemporaryAudience(page, tempName);

    const recipients = await readAudienceRecipientCount(page);
    console.log(`[audience-builder] ${audienceName} (${playbookId}, ${hotelName}) : ${recipients} destinataire(s)`);

    const savedName = tempName;
    if (!persistAs) {
      await deleteAudience(page, savedName);
    }
    tempName = null;

    return { definitionId: audienceId, name: audienceName, recipients, listName: persistAs ? savedName : null };
  } catch (error) {
    if (tempName && !persistAs) {
      try {
        await deleteAudience(page, tempName);
      } catch (cleanupError) {
        console.error(`[audience-builder] Nettoyage de sécurité impossible pour ${tempName} :`, cleanupError);
      }
    }
    throw error;
  }
}
