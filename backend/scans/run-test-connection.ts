import { prisma } from "../src/db/prisma.js";
import type { SessionProvider, ExperienceCredentials } from "../experience/core/session.js";
import { connectToExperience as defaultConnectToExperience } from "../experience/core/session.js";
import { selectHotel } from "../experience/core/navigation.js";

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

// "Tester la connexion" n'a personne devant le navigateur pour compléter
// une 2FA — contrairement à un scan, où connectToExperience() attend
// jusqu'à 3 min qu'un humain s'en charge. Retour réel 2026-09-03 : sans
// ce délai raccourci, le bouton restait figé sur "Test en cours…"
// jusqu'à 3 minutes sans que rien ne l'indique. 15s suffit largement à
// confirmer qu'une session déjà authentifiée est bien active.
const AUTH_CHECK_TIMEOUT_MS = 15000;

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
    try {
      await defaultConnectToExperience(session.page, options.credentials, { manualLoginTimeoutMs: AUTH_CHECK_TIMEOUT_MS });
    } catch (error) {
      const technicalMessage = error instanceof Error ? (error.stack ?? error.message) : String(error);
      console.error(`[test-connection] Session Expérience non authentifiée :`, technicalMessage);

      await prisma.hotel.update({
        where: { id: options.hotelId },
        data: { experienceStatus: "ERROR", lastConnectionCheckAt: new Date() }
      });
      return {
        status: "ERROR",
        message: "Aucune session Expérience active — connecte-toi manuellement une première fois (ex. en lançant un scan) avant de retester."
      };
    }

    try {
      await selectHotel(session.page, options.hotelName);
    } catch (error) {
      const technicalMessage = error instanceof Error ? (error.stack ?? error.message) : String(error);
      console.error(`[test-connection] ${options.hotelName} introuvable :`, technicalMessage);

      await prisma.hotel.update({
        where: { id: options.hotelId },
        data: { experienceStatus: "NOT_FOUND", lastConnectionCheckAt: new Date() }
      });
      return {
        status: "NOT_FOUND",
        message: `Aucun hôtel nommé "${options.hotelName}" trouvé dans Expérience — vérifie le libellé exact.`
      };
    }

    await prisma.hotel.update({
      where: { id: options.hotelId },
      data: { experienceStatus: "ACTIVE", lastConnectionCheckAt: new Date() }
    });
    return { status: "ACTIVE", message: "Connexion validée — l'hôtel a bien été retrouvé dans Expérience." };
  } finally {
    await session.close();
  }
}
