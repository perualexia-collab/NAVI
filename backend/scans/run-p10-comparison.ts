import { prisma } from "../src/db/prisma.js";
import type { SessionProvider, ExperienceCredentials } from "../experience/core/session.js";
import { connectToExperience as defaultConnectToExperience } from "../experience/core/session.js";
import { selectHotel } from "../experience/core/navigation.js";
import type { ScanPeriod } from "../experience/core/config.js";
import { classifyErrorType } from "../experience/errors.js";
import { openAutomationStatusP10, readAutomationDistributionP10, classifyAutomationStatusP10, type AutomationStatus } from "../experience/audience-builder/p10-automation-status.js";
import { currentMonthNameFR, getP10StarRule, getMonthlyRecommendationsP10 } from "../experience/audience-builder/p10-campaigns.js";
import { buildP10AudienceFilter } from "../experience/audience-builder/p10-filters.js";
import { scrapeAverageSpendPerBooking } from "../experience/audience-builder/average-spend.js";
import { computeAudiencePreview } from "../experience/audience-builder/compute-audience.js";

export interface ExecuteP10ComparisonOptions {
  hotelId: string;
  hotelName: string;
  /** Returning Guests % (N) du dernier scan — pilote la règle ⭐ (getP10StarRule). */
  returningRate: number;
  /** Période du dernier scan — réutilisée pour le seuil dynamique "Clients à forte valeur" si l'une des 3 campagnes du mois l'utilise. */
  period: ScanPeriod;
  sessionProvider: SessionProvider;
  credentials?: ExperienceCredentials;
}

export interface ExecuteP10ComparisonResult {
  /** true si les automations ne sont pas correctement actives — aucune campagne n'a été recherchée ni mesurée. */
  blocked: boolean;
  automationStatus: AutomationStatus;
  comparisonId: string | null;
}

/**
 * Phase E3 — P10 "Comparer les audiences". Contrairement au script
 * d'origine (`runP10Playbook`, qui demandait le choix de campagne AVANT
 * toute mesure), l'architecture validée pour NAVI inverse l'ordre pour
 * suivre le modèle P11 : les 3 campagnes du mois sont mesurées d'abord,
 * l'utilisateur choisit ensuite avec le volume réel sous les yeux (le
 * "vrai changement de logique" signalé par l'audit d'architecture).
 *
 * Vérifie d'abord le statut des automations marketing
 * (`p10-automation-status.ts` — la partie la plus fragile du moteur
 * existant, détection par géométrie DOM) : si elles ne sont pas
 * correctement actives, NAVI s'arrête là (rien à comparer tant que la
 * base d'automations n'est pas fiable) et retourne le statut pour que
 * l'utilisateur sache quoi corriger.
 */
export async function executeP10Comparison(options: ExecuteP10ComparisonOptions): Promise<ExecuteP10ComparisonResult> {
  const session = await options.sessionProvider.open();

  try {
    await defaultConnectToExperience(session.page, options.credentials);
    await selectHotel(session.page, options.hotelName);

    await openAutomationStatusP10(session.page);
    const distribution = await readAutomationDistributionP10(session.page);
    const automationStatus = classifyAutomationStatusP10(distribution);

    if (automationStatus.action !== "SEARCH_PUNCTUAL_CAMPAIGN") {
      return { blocked: true, automationStatus, comparisonId: null };
    }

    const starRule = getP10StarRule(options.returningRate);
    const monthName = currentMonthNameFR();
    const recommendations = getMonthlyRecommendationsP10(monthName, starRule);

    const measurements: { audienceDefinitionId: string; recipients: number; highlighted: boolean }[] = [];
    for (const campaign of recommendations) {
      const averageSpend =
        campaign.audienceDefinitionId === "P10_HIGH_VALUE" ? await scrapeAverageSpendPerBooking(session.page, options.period) : undefined;

      const preview = await computeAudiencePreview(session.page, {
        hotelName: options.hotelName,
        playbookId: "P10",
        audienceId: campaign.audienceDefinitionId,
        audienceName: campaign.name,
        buildFilters: (page) => buildP10AudienceFilter(page, campaign.audience, averageSpend)
      });

      measurements.push({ audienceDefinitionId: campaign.audienceDefinitionId, recipients: preview.recipients, highlighted: campaign.starred });
    }

    const comparison = await prisma.audienceComparison.create({
      data: {
        hotelId: options.hotelId,
        playbookId: "P10",
        results: {
          create: measurements.map((measurement) => ({
            hotelId: options.hotelId,
            audienceDefinitionId: measurement.audienceDefinitionId,
            recipients: measurement.recipients,
            highlighted: measurement.highlighted
          }))
        }
      }
    });

    return { blocked: false, automationStatus, comparisonId: comparison.id };
  } catch (error) {
    const errorType = classifyErrorType(error);
    const technicalMessage = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(`[p10-comparison] ${options.hotelName} :`, technicalMessage);

    throw new Error(
      errorType === "AUTHENTICATION_ERROR"
        ? "La session Expérience n'est plus valide — reconnexion nécessaire."
        : "La comparaison des audiences a échoué dans Expérience — nouvel essai possible."
    );
  } finally {
    await session.close();
  }
}
