import "dotenv/config";
import { loadEnv } from "../src/config/env.js";
import { PersistentProfileSessionProvider, connectToExperience } from "./core/session.js";

/**
 * Connexion interactive à Expérience — à lancer une seule fois (ou quand
 * la session a expiré), en tête-à-tête avec le navigateur affiché via
 * noVNC (cf. README, section Codespaces). Toujours headed (`headless:
 * false`), quelle que soit la valeur de PLAYWRIGHT_HEADLESS : ce n'est PAS
 * ce que les scans utilisent au quotidien, qui restent headless via
 * l'API. Une fois la session authentifiée, le profil persistant
 * (EXPERIENCE_PROFILE_DIR) contient les cookies — tous les scans headless
 * suivants les réutilisent tels quels, sans repasser par ce script.
 */
async function main() {
  const env = loadEnv();

  const provider = new PersistentProfileSessionProvider({
    userDataDir: env.EXPERIENCE_PROFILE_DIR,
    headless: false
  });

  console.log("Ouverture du navigateur Expérience (visible via noVNC)...");
  const session = await provider.open();

  try {
    await connectToExperience(session.page, {
      email: env.EXPERIENCE_SERVICE_ACCOUNT_EMAIL,
      password: env.EXPERIENCE_SERVICE_ACCOUNT_PASSWORD
    });
    console.log("✅ Session Expérience active — cookies persistés dans", env.EXPERIENCE_PROFILE_DIR);
    console.log("Les prochains scans (headless) réutiliseront cette session automatiquement.");
    // Laisse le temps aux dernières requêtes réseau (cookies de session) de
    // se terminer avant de fermer — launchPersistentContext écrit sur
    // disque en continu, mais pas nécessairement de façon synchrone.
    await session.page.waitForTimeout(2000);
  } finally {
    await session.close();
  }
}

main().catch((error) => {
  console.error("Échec de la connexion Expérience :", error);
  process.exitCode = 1;
});
