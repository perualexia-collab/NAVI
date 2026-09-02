import { prisma } from "../src/db/prisma.js";
import type { SessionProvider, ExperienceCredentials } from "../experience/core/session.js";
import { connectToExperience as defaultConnectToExperience } from "../experience/core/session.js";
import { selectHotel } from "../experience/core/navigation.js";
import type { ScanPeriod } from "../experience/core/config.js";
import { classifyErrorType } from "../experience/errors.js";
import { AUDIENCE_DEFINITIONS } from "../experience/audience-builder/definitions.js";
import { buildAudienceDefinition } from "../experience/audience-builder/filters.js";
import { scrapeAverageSpendPerBooking } from "../experience/audience-builder/average-spend.js";
import { computeAudiencePreview } from "../experience/audience-builder/compute-audience.js";

export interface ExecuteAudienceComputeOptions {
  hotelId: string;
  hotelName: string;
  playbookId: string;
  audienceDefinitionId: string;
  /** Période du scan à l'origine du signal — réutilisée pour le seuil dynamique P09 (dépense moyenne). */
  period: ScanPeriod;
  sessionProvider: SessionProvider;
  credentials?: ExperienceCredentials;
}

export interface ExecuteAudienceComputeResult {
  audienceResultId: string;
  audienceDefinitionId: string;
  recipients: number;
  measuredAt: string;
}

/**
 * Phase E2 — "Calculer l'audience" pour un signal à option unique
 * (P02, P03, P04, P06, P07, P09). Ouvre sa propre session Playwright
 * (jamais partagée, même contrainte que les scans — cf. backend/scans/queue.ts),
 * sélectionne l'hôtel puis exécute le cycle créer/mesurer/supprimer
 * (backend/experience/audience-builder/compute-audience.ts), et persiste
 * le résultat en `AudienceResult`.
 *
 * Lancé de façon synchrone dans la requête HTTP (comme `runHotelScan()`
 * pour un scan mono-hôtel) plutôt que via la file BullMQ : contrairement
 * à un scan de portefeuille, il n'y a ici qu'un seul hôtel et un seul job
 * à la fois — pas de besoin de fan-out.
 */
export async function executeAudienceCompute(options: ExecuteAudienceComputeOptions): Promise<ExecuteAudienceComputeResult> {
  const definition = AUDIENCE_DEFINITIONS[options.audienceDefinitionId];
  if (!definition) throw new Error(`Définition d'audience inconnue : ${options.audienceDefinitionId}`);

  const session = await options.sessionProvider.open();

  try {
    await defaultConnectToExperience(session.page, options.credentials);
    await selectHotel(session.page, options.hotelName);

    const dynamicValues: Record<string, number> = {};
    const needsAverageSpend = definition.filters.some((filter) => filter.field === "stayAmount" && filter.dynamicValue === "averageSpend");
    if (needsAverageSpend) {
      dynamicValues.averageSpend = await scrapeAverageSpendPerBooking(session.page, options.period);
    }

    const preview = await computeAudiencePreview(session.page, {
      hotelName: options.hotelName,
      playbookId: options.playbookId,
      audienceId: definition.id,
      audienceName: definition.name,
      buildFilters: (page) => buildAudienceDefinition(page, definition, dynamicValues)
    });

    const audienceResult = await prisma.audienceResult.create({
      data: { hotelId: options.hotelId, audienceDefinitionId: definition.id, recipients: preview.recipients }
    });

    return {
      audienceResultId: audienceResult.id,
      audienceDefinitionId: audienceResult.audienceDefinitionId,
      recipients: audienceResult.recipients,
      measuredAt: audienceResult.measuredAt.toISOString()
    };
  } catch (error) {
    const errorType = classifyErrorType(error);
    const technicalMessage = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(`[audience-compute] ${options.playbookId}/${options.audienceDefinitionId} sur ${options.hotelName} :`, technicalMessage);

    throw new Error(
      errorType === "AUTHENTICATION_ERROR"
        ? "La session Expérience n'est plus valide — reconnexion nécessaire."
        : "Le calcul de l'audience a échoué dans Expérience — nouvel essai possible."
    );
  } finally {
    await session.close();
  }
}
