import { prisma } from "../src/db/prisma.js";
import type { SessionProvider, ExperienceCredentials } from "../experience/core/session.js";
import { connectToExperience as defaultConnectToExperience } from "../experience/core/session.js";
import { selectHotel } from "../experience/core/navigation.js";
import { classifyErrorType } from "../experience/errors.js";
import { P11_OPPORTUNITIES } from "../experience/audience-builder/p11-opportunities.js";
import { computeAudiencePreview } from "../experience/audience-builder/compute-audience.js";
import { calculateOpportunityScore } from "../src/services/scoring/p11-opportunity.js";

export interface ExecuteP11OpportunityFinderOptions {
  hotelId: string;
  hotelName: string;
  sessionProvider: SessionProvider;
  credentials?: ExperienceCredentials;
}

export interface ExecuteP11OpportunityFinderResult {
  comparisonId: string;
}

/**
 * Phase E3 — "Comparer les opportunités" (P11, signal MULTIPLE). Mesure
 * les 3 opportunités du catalogue (`P11_OPPORTUNITIES`) l'une après
 * l'autre — chacune via le même cycle créer/mesurer/supprimer que E2
 * (`computeAudiencePreview`, réutilisé tel quel : P11 ne fait qu'appliquer
 * ce cycle trois fois puis classer, cf. docs/reference/phase-e-notes.md).
 * Persiste les 3 résultats sous un même `AudienceComparison`, avec
 * `highlighted` sur la seule opportunité recommandée (meilleur score
 * total, ET ≥ 40/100 — sinon aucune n'est mise en avant, conformément au
 * classement d'origine).
 */
export async function executeP11OpportunityFinder(options: ExecuteP11OpportunityFinderOptions): Promise<ExecuteP11OpportunityFinderResult> {
  const session = await options.sessionProvider.open();

  try {
    await defaultConnectToExperience(session.page, options.credentials);
    await selectHotel(session.page, options.hotelName);

    const measurements = [];
    for (const opportunity of P11_OPPORTUNITIES) {
      const preview = await computeAudiencePreview(session.page, {
        hotelName: options.hotelName,
        playbookId: "P11",
        definition: opportunity,
        dynamicValues: {}
      });
      const scoring = calculateOpportunityScore(opportunity, preview.recipients);
      measurements.push({ opportunity, recipients: preview.recipients, scoring });
    }

    const ranked = [...measurements].sort((a, b) => {
      if (b.scoring.totalScore !== a.scoring.totalScore) return b.scoring.totalScore - a.scoring.totalScore;
      if (b.scoring.potentialScore !== a.scoring.potentialScore) return b.scoring.potentialScore - a.scoring.potentialScore;
      return b.recipients - a.recipients;
    });
    const recommendedId = ranked[0] && ranked[0].scoring.totalScore >= 40 ? ranked[0].opportunity.id : null;

    const comparison = await prisma.audienceComparison.create({
      data: {
        hotelId: options.hotelId,
        playbookId: "P11",
        results: {
          create: measurements.map((measurement) => ({
            hotelId: options.hotelId,
            audienceDefinitionId: measurement.opportunity.id,
            recipients: measurement.recipients,
            highlighted: measurement.opportunity.id === recommendedId
          }))
        }
      }
    });

    return { comparisonId: comparison.id };
  } catch (error) {
    const errorType = classifyErrorType(error);
    const technicalMessage = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(`[p11-opportunity-finder] ${options.hotelName} :`, technicalMessage);

    throw new Error(
      errorType === "AUTHENTICATION_ERROR"
        ? "La session Expérience n'est plus valide — reconnexion nécessaire."
        : "La comparaison des opportunités a échoué dans Expérience — nouvel essai possible."
    );
  } finally {
    await session.close();
  }
}
