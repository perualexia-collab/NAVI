import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { EXPERIENCE_BASE_URL } from "./config.js";

/**
 * Abstraction de session Expérience — brief §07 de l'échange de validation
 * Phase B→C : "isole clairement la gestion de session derrière une
 * abstraction afin que nous puissions remplacer cette stratégie avant un
 * déploiement multi-utilisateurs. Ne construis pas encore un système
 * complexe de gestion 2FA."
 *
 * Implémentation actuelle : identique au script existant — un profil
 * navigateur persistant (`launchPersistentContext`), 2FA résolue
 * manuellement une fois. C'est la seule stratégie que ce premier vertical
 * slice a vocation à prouver. Une stratégie multi-workers (storageState
 * partagé, compte de service) remplacera cette implémentation sans
 * toucher au reste du moteur (backend/experience/scrapers,
 * backend/scans) — c'est précisément ce que cette interface permet.
 */
export interface ExperienceSession {
  context: BrowserContext;
  page: Page;
  close(): Promise<void>;
}

export interface SessionProvider {
  open(): Promise<ExperienceSession>;
}

export interface PersistentProfileSessionProviderOptions {
  userDataDir: string;
  headless: boolean;
}

export class PersistentProfileSessionProvider implements SessionProvider {
  constructor(private readonly options: PersistentProfileSessionProviderOptions) {}

  async open(): Promise<ExperienceSession> {
    const context = await chromium.launchPersistentContext(this.options.userDataDir, {
      headless: this.options.headless,
      viewport: this.options.headless ? { width: 1440, height: 900 } : null
    });

    const page = context.pages()[0] ?? (await context.newPage());

    return {
      context,
      page,
      close: () => context.close()
    };
  }
}

/**
 * Vérifie qu'une session Expérience authentifiée est active ; si non,
 * attend une connexion manuelle (2FA comprise) — porté à l'identique
 * depuis connectToExperience() du script existant.
 */
export async function connectToExperience(page: Page): Promise<void> {
  await page.goto(EXPERIENCE_BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);

  const hotelSearch = page.getByRole("searchbox", { name: /Rechercher/i });
  const xpLink = page.getByRole("link", { name: "XP", exact: true });
  const changeSpace = page.getByRole("button", { name: /Changer d'espace/i });

  const authenticated =
    (await hotelSearch.first().isVisible().catch(() => false)) ||
    (await xpLink.first().isVisible().catch(() => false)) ||
    (await changeSpace.first().isVisible().catch(() => false));

  if (authenticated) return;

  const loginButton = page.getByRole("button", { name: /Connexion/i });
  if (await loginButton.isVisible().catch(() => false)) {
    await loginButton.click();
    await page.waitForTimeout(800);
  }

  // Aucune automatisation de 2FA — un humain doit compléter la connexion
  // dans la fenêtre du navigateur pendant cette attente (jusqu'à 3 min).
  await Promise.race([
    hotelSearch.first().waitFor({ state: "visible", timeout: 180000 }),
    xpLink.first().waitFor({ state: "visible", timeout: 180000 }),
    changeSpace.first().waitFor({ state: "visible", timeout: 180000 })
  ]);
}
