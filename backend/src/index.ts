import "dotenv/config";
import { loadEnv } from "./config/env.js";
import { buildApp } from "./app.js";
import { startScanWorker } from "../scans/worker.js";

const env = loadEnv();
const app = await buildApp(env);

// Worker BullMQ (Phase D1) — même process que l'API pour l'instant, cf.
// commentaire dans backend/scans/worker.ts.
const scanWorker = startScanWorker(env);

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  await scanWorker.close();
  process.exit(1);
}
