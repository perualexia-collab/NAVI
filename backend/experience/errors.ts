import type { ScanErrorType, ScanStepName } from "@navi/shared";

/**
 * Classification des erreurs Expérience — brief §12 : l'utilisateur ne
 * doit jamais recevoir un message Playwright brut. `handleExperienceError`
 * était identifié comme fonction à créer dans l'audit (NAVI Architecture
 * Proposal §03/§07) ; elle n'existe pas dans le script d'origine, où les
 * erreurs remontaient par throw brut.
 */

const STEP_USER_MESSAGE: Record<ScanStepName, string> = {
  BASE: "La taille de la base et l'activabilité n'ont pas pu être récupérées dans Expérience.",
  CAPTURE: "Le taux de captation e-mail n'a pas pu être récupéré dans Expérience.",
  OTA: "Les parts OTA / Non OTA n'ont pas pu être récupérées dans Expérience.",
  RETURNING: "Le taux de Returning Guests n'a pas pu être récupéré dans Expérience.",
  MARKETING: "Les statistiques marketing (CA, réservations) n'ont pas pu être récupérées dans Expérience."
};

export interface ClassifiedExperienceError {
  errorType: ScanErrorType;
  userMessage: string;
  technicalMessage: string;
}

function classifyErrorType(error: unknown): ScanErrorType {
  const message = error instanceof Error ? error.message : String(error);

  if (/Timeout \d+ms exceeded/i.test(message) || /waitFor/i.test(message)) return "TIMEOUT";
  if (/introuvable|illisible|Impossible de lire|Impossible de sélectionner/i.test(message)) return "ELEMENT_NOT_FOUND";
  if (/net::ERR_|ERR_CONNECTION|page\.goto/i.test(message)) return "PAGE_UNAVAILABLE";
  if (/Connexion Expérience|authentif/i.test(message)) return "AUTHENTICATION_ERROR";
  if (/Sélection hôtel|hôtel introuvable/i.test(message)) return "HOTEL_NOT_FOUND";
  if (/Navigation|Reporting|Ouverture/i.test(message)) return "NAVIGATION_ERROR";
  return "UNKNOWN_ERROR";
}

export function handleExperienceError(step: ScanStepName, error: unknown): ClassifiedExperienceError {
  const errorType = classifyErrorType(error);
  const technicalMessage = error instanceof Error ? (error.stack ?? error.message) : String(error);

  const userMessage =
    errorType === "AUTHENTICATION_ERROR"
      ? "La session Expérience n'est plus valide — reconnexion nécessaire."
      : errorType === "HOTEL_NOT_FOUND"
        ? "Cet hôtel n'a pas été retrouvé dans Expérience."
        : STEP_USER_MESSAGE[step];

  return { errorType, userMessage, technicalMessage };
}
