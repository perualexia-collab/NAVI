import { Worker } from "bullmq";
import type { Env } from "../src/config/env.js";
import { PersistentProfileSessionProvider } from "../experience/core/session.js";
import { executeHotelScan } from "./run-hotel-scan.js";
import { SCAN_QUEUE_NAME, getRedisConnection, type HotelScanJobData } from "./queue.js";

/**
 * Worker BullMQ — Phase D1. Traite un job = un hôtel, en ouvrant sa propre
 * session Playwright (jamais partagée entre jobs, cf. avertissement
 * SingletonLock dans queue.ts). Tourne dans le même process que l'API pour
 * l'instant (simplicité en devcontainer) — un process dédié
 * (`scan-worker`, déjà esquissé en commentaire dans docker-compose.yml)
 * reste l'évolution naturelle en production, pas un prérequis de D1.
 */
export function startScanWorker(env: Env): Worker<HotelScanJobData> {
  const worker = new Worker<HotelScanJobData>(
    SCAN_QUEUE_NAME,
    async (job) => {
      const sessionProvider = new PersistentProfileSessionProvider({
        userDataDir: env.EXPERIENCE_PROFILE_DIR,
        headless: env.PLAYWRIGHT_HEADLESS
      });

      await executeHotelScan({
        scanId: job.data.scanId,
        scanHotelId: job.data.scanHotelId,
        hotelId: job.data.hotelId,
        period: job.data.period,
        sessionProvider,
        credentials: {
          email: env.EXPERIENCE_SERVICE_ACCOUNT_EMAIL,
          password: env.EXPERIENCE_SERVICE_ACCOUNT_PASSWORD
        }
      });
    },
    { connection: getRedisConnection(env.REDIS_URL), concurrency: env.SCAN_QUEUE_CONCURRENCY }
  );

  worker.on("failed", (job, error) => {
    // executeHotelScan() persiste déjà l'échec métier (ScanHotel FAILED,
    // ScanError) — ce log couvre uniquement le cas où le job plante avant
    // d'atteindre ce traitement (ex. Redis/DB injoignable), pour ne jamais
    // échouer en silence.
    console.error(`[scan-worker] Job hôtel ${job?.data.hotelId} (scanHotel ${job?.data.scanHotelId}) en échec :`, error);
  });

  return worker;
}
