import { existsSync } from "node:fs";
import type { Page } from "playwright";
import { beforeAll, describe, expect, it } from "vitest";
import { PersistentProfileSessionProvider } from "../core/session.js";
import { EXPERIENCE_BASE_URL } from "../core/config.js";
import { runHotelScan } from "../../scans/run-hotel-scan.js";
import { prisma } from "../../src/db/prisma.js";
import { loadEnv, type Env } from "../../src/config/env.js";
import { pilotHotel } from "../../prisma/seed-data/pilot-hotel.js";

/**
 * Test de reproductibilité LOCALE du vertical slice réel (Phase C,
 * clôture) — PAS destiné à la CI : nécessite une session Expérience déjà
 * authentifiée via `pnpm --filter @navi/backend connect:experience`
 * (2FA manuelle comprise, une fois). Ignoré proprement — jamais en échec
 * — si le profil est absent ou la session expirée : `pnpm test:e2e` ne
 * casse jamais un run sans accès Expérience.
 *
 * Aucun secret dans ce fichier : les identifiants viennent de
 * l'environnement (backend/.env, jamais committé), exactement comme pour
 * l'API — voir backend/experience/core/session.ts.
 */

let env: Env;
let sessionReady = false;

async function isSessionActive(page: Page): Promise<boolean> {
  await page.goto(EXPERIENCE_BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const hotelSearch = page.getByRole("searchbox", { name: /Rechercher/i });
  const xpLink = page.getByRole("link", { name: "XP", exact: true });
  const changeSpace = page.getByRole("button", { name: /Changer d'espace/i });
  return (
    (await hotelSearch.first().isVisible().catch(() => false)) ||
    (await xpLink.first().isVisible().catch(() => false)) ||
    (await changeSpace.first().isVisible().catch(() => false))
  );
}

beforeAll(async () => {
  env = loadEnv();

  if (!existsSync(env.EXPERIENCE_PROFILE_DIR)) {
    console.warn(
      `[e2e] Profil Expérience absent (${env.EXPERIENCE_PROFILE_DIR}) — lance "pnpm --filter @navi/backend connect:experience" d'abord. Test ignoré.`
    );
    return;
  }

  const provider = new PersistentProfileSessionProvider({ userDataDir: env.EXPERIENCE_PROFILE_DIR, headless: true });
  const session = await provider.open();
  try {
    sessionReady = await isSessionActive(session.page);
  } finally {
    await session.close();
  }

  if (!sessionReady) {
    console.warn(
      '[e2e] Session Expérience non active (profil présent mais pas authentifié, ou expiré) — relance "pnpm --filter @navi/backend connect:experience". Test ignoré.'
    );
  }
}, 30000);

describe("Vertical slice réel — hôtel pilote (Phase C)", () => {
  it("exécute un scan réel de bout en bout via Expérience", async (ctx) => {
    if (!sessionReady) {
      ctx.skip();
      return;
    }

    const hotel = await prisma.hotel.findFirst({ where: { name: pilotHotel.name } });
    expect(hotel, "hôtel pilote introuvable en base — as-tu bien lancé le seed ?").toBeTruthy();

    const admin = await prisma.user.findFirst({ where: { role: "ADMIN", status: "ACTIVE" } });
    expect(admin, "aucun admin actif en base").toBeTruthy();

    const sessionProvider = new PersistentProfileSessionProvider({
      userDataDir: env.EXPERIENCE_PROFILE_DIR,
      headless: env.PLAYWRIGHT_HEADLESS
    });

    const result = await runHotelScan({
      hotelId: hotel!.id,
      period: { mode: "preset", value: "last12Months" },
      requestedById: admin!.id,
      sessionProvider,
      credentials: {
        email: env.EXPERIENCE_SERVICE_ACCOUNT_EMAIL,
        password: env.EXPERIENCE_SERVICE_ACCOUNT_PASSWORD
      }
    });

    expect(["SUCCESS", "PARTIAL_SUCCESS", "FAILED"]).toContain(result.status);

    const scanHotel = await prisma.scanHotel.findUniqueOrThrow({
      where: { id: result.scanHotelId },
      include: { steps: true, kpiResults: true, errors: true }
    });

    expect(scanHotel.steps).toHaveLength(5);
    expect(scanHotel.steps.every((s) => s.status === "OK" || s.status === "ERROR")).toBe(true);

    if (result.status === "SUCCESS") {
      expect(scanHotel.healthScore).not.toBeNull();
      expect(scanHotel.kpiResults.length).toBeGreaterThan(0);
    }
    if (result.status === "FAILED") {
      expect(scanHotel.errors.length).toBeGreaterThan(0);
    }

    console.log(
      `[e2e] Scan ${result.status} — ${scanHotel.kpiResults.length} KPI persistés, healthScore=${scanHotel.healthScore ?? "null"}`
    );
  });
});
