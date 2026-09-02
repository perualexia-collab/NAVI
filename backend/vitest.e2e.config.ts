import { defineConfig } from "vitest/config";

/**
 * Config dédiée au test E2E réel (backend/experience/__tests__) — séparée
 * du reste pour ne jamais tourner en CI par accident : `pnpm test:e2e`
 * est une commande explicite, locale, nécessitant une session Expérience
 * déjà authentifiée (voir README).
 */
export default defineConfig({
  test: {
    include: ["**/*.e2e.test.ts"],
    testTimeout: 5 * 60 * 1000,
    hookTimeout: 30000
  }
});
