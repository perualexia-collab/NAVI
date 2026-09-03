import { prisma } from "../src/db/prisma.js";
import type { SessionProvider, ExperienceCredentials } from "../experience/core/session.js";
import { connectToExperience as defaultConnectToExperience } from "../experience/core/session.js";
import { selectHotel } from "../experience/core/navigation.js";
import { classifyErrorType } from "../experience/errors.js";

export interface ExecuteTestConnectionOptions {
  hotelId: string;
  /** experienceLabel — nom recherché dans Expérience. */
  hotelName: string;
  sessionProvider: SessionProvider;
  credentials?: ExperienceCredentials;
}

export interface ExecuteTestConnectionResult {
  status: "ACTIVE" | "NOT_FOUND" | "ERROR";
  message: string;
}

/**
 * Paramètres → Hôtels → "Tester la connexion" — la vérification
 * automatique évoquée depuis la création d'un hôtel ("recherche par nom
 * normalisé... se fera via Playwright dans une prochaine passe") jamais
 * construite jusqu'ici. Réutilise exactement la même primitive que le
 * tout début d'un scan (`selectHotel`) — si la recherche/sélection
 * réussit ici, un scan sur cet hôtel a de bonnes chances de fonctionner
 * aussi.
 */
export async function executeTestConnection(options: ExecuteTestConnectionOptions): Promise<ExecuteTestConnectionResult> {
  const session = await options.sessionProvider.open();

  try {
    await defaultConnectToExperience(session.page, options.credentials);
    await selectHotel(session.page, options.hotelName);

    await prisma.hotel.update({
      where: { id: options.hotelId },
      data: { experienceStatus: "ACTIVE", lastConnectionCheckAt: new Date() }
    });

    return { status: "ACTIVE", message: "Connexion validée — l'hôtel a bien été retrouvé dans Expérience." };
  } catch (error) {
    const errorType = classifyErrorType(error);
    const technicalMessage = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(`[test-connection] ${options.hotelName} :`, technicalMessage);

    const status = errorType === "AUTHENTICATION_ERROR" ? "ERROR" : "NOT_FOUND";
    const message =
      errorType === "AUTHENTICATION_ERROR"
        ? "La session Expérience n'est plus valide — reconnexion nécessaire."
        : `Aucun hôtel nommé "${options.hotelName}" trouvé dans Expérience — vérifie le libellé exact.`;

    await prisma.hotel.update({
      where: { id: options.hotelId },
      data: { experienceStatus: status, lastConnectionCheckAt: new Date() }
    });

    return { status, message };
  } finally {
    await session.close();
  }
}
