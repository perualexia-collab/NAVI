import { prisma } from "../src/db/prisma.js";
import type { Page } from "playwright";
import type { SessionProvider, ExperienceCredentials } from "../experience/core/session.js";
import { connectToExperience as defaultConnectToExperience } from "../experience/core/session.js";
import { selectHotel } from "../experience/core/navigation.js";
import type { ScanPeriod } from "../experience/core/config.js";
import { classifyErrorType } from "../experience/errors.js";
import { AUDIENCE_DEFINITIONS } from "../experience/audience-builder/definitions.js";
import { buildAudienceDefinition } from "../experience/audience-builder/filters.js";
import { P11_OPPORTUNITIES } from "../experience/audience-builder/p11-opportunities.js";
import { AUDIENCE_TAG_TO_DEFINITION_ID } from "../experience/audience-builder/p10-campaigns.js";
import { buildP10AudienceFilter } from "../experience/audience-builder/p10-filters.js";
import { scrapeAverageSpendPerBooking } from "../experience/audience-builder/average-spend.js";
import { computeAudiencePreview } from "../experience/audience-builder/compute-audience.js";

/**
 * Phase F1 — "Créer la liste dans Expérience" : contrairement à
 * "Calculer l'audience"/"Comparer..." (E2/E3, listes toujours
 * temporaires puis supprimées), cette action conserve réellement la
 * liste dans Expérience une fois l'audience choisie — utilisable telle
 * quelle par l'équipe marketing pour une campagne. Un seul dispatcher de
 * filtres, réutilisé pour les 3 catalogues d'audience (E2, P11, P10) —
 * leurs ids ne se recoupent jamais (RISK_INACTIVITY… / P11_ONETIMER… /
 * P10_REPEATERS…), donc un seul id suffit à retrouver le bon catalogue.
 */
async function buildFiltersForAudience(page: Page, audienceDefinitionId: string, dynamicValues: Record<string, number>): Promise<void> {
  const e2Definition = AUDIENCE_DEFINITIONS[audienceDefinitionId];
  if (e2Definition) return buildAudienceDefinition(page, e2Definition, dynamicValues);

  const p11Opportunity = P11_OPPORTUNITIES.find((opportunity) => opportunity.id === audienceDefinitionId);
  if (p11Opportunity) return buildAudienceDefinition(page, p11Opportunity, dynamicValues);

  const p10Tag = Object.entries(AUDIENCE_TAG_TO_DEFINITION_ID).find(([, id]) => id === audienceDefinitionId)?.[0];
  if (p10Tag) return buildP10AudienceFilter(page, p10Tag, dynamicValues.averageSpend);

  throw new Error(`Définition d'audience inconnue pour la création de liste : ${audienceDefinitionId}`);
}

const HIGH_VALUE_AUDIENCE_DEFINITION_IDS = new Set(["HIGH_VALUE_ONE_TIMER", "P10_HIGH_VALUE"]);

export interface ExecuteCreateAudienceListOptions {
  hotelId: string;
  hotelName: string;
  playbookId: string;
  audienceDefinitionId: string;
  listName: string;
  /** Réutilisée pour le seuil dynamique "Clients à forte valeur" (P09/P10) si nécessaire. */
  period: ScanPeriod;
  sessionProvider: SessionProvider;
  credentials?: ExperienceCredentials;
}

export interface ExecuteCreateAudienceListResult {
  listName: string;
  recipients: number;
  audienceResultId: string;
  measuredAt: string;
}

export async function executeCreateAudienceList(options: ExecuteCreateAudienceListOptions): Promise<ExecuteCreateAudienceListResult> {
  const session = await options.sessionProvider.open();

  try {
    await defaultConnectToExperience(session.page, options.credentials);
    await selectHotel(session.page, options.hotelName);

    const dynamicValues: Record<string, number> = {};
    if (HIGH_VALUE_AUDIENCE_DEFINITION_IDS.has(options.audienceDefinitionId)) {
      dynamicValues.averageSpend = await scrapeAverageSpendPerBooking(session.page, options.period);
    }

    const preview = await computeAudiencePreview(session.page, {
      hotelName: options.hotelName,
      playbookId: options.playbookId,
      audienceId: options.audienceDefinitionId,
      audienceName: options.listName,
      buildFilters: (page) => buildFiltersForAudience(page, options.audienceDefinitionId, dynamicValues),
      persistAs: options.listName
    });

    const audienceResult = await prisma.audienceResult.create({
      data: { hotelId: options.hotelId, audienceDefinitionId: options.audienceDefinitionId, recipients: preview.recipients }
    });

    return {
      listName: preview.listName!,
      recipients: preview.recipients,
      audienceResultId: audienceResult.id,
      measuredAt: audienceResult.measuredAt.toISOString()
    };
  } catch (error) {
    const errorType = classifyErrorType(error);
    const technicalMessage = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(`[create-audience-list] ${options.playbookId}/${options.audienceDefinitionId} sur ${options.hotelName} :`, technicalMessage);

    throw new Error(
      errorType === "AUTHENTICATION_ERROR"
        ? "La session Expérience n'est plus valide — reconnexion nécessaire."
        : "La création de la liste a échoué dans Expérience — nouvel essai possible. Vérifie dans Expérience qu'aucune liste partielle n'a été créée."
    );
  } finally {
    await session.close();
  }
}
