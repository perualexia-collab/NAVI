import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { ScanPeriod } from "../experience/core/config.js";

/**
 * File de scans multi-hôtels — Phase D1 (brief architecture-proposal.html,
 * "Phase D — Scan multi-hôtels"). Un job indépendant par hôtel
 * (`scanHotelId`), traité par backend/scans/worker.ts. La concurrence est
 * bornée par `SCAN_QUEUE_CONCURRENCY` — volontairement 1 par défaut : les
 * jobs partagent le même profil Playwright persistant
 * (`EXPERIENCE_PROFILE_DIR`), et deux navigateurs ouverts simultanément sur
 * le même profil se bloquent mutuellement (`SingletonLock`, constaté en
 * conditions réelles pendant la clôture de la Phase C — voir
 * docs/reference/phase-c-real-connection-notes.md). Augmenter cette valeur
 * suppose d'abord de donner à chaque job son propre répertoire de profil.
 */
export interface HotelScanJobData {
  scanId: string;
  scanHotelId: string;
  hotelId: string;
  period: ScanPeriod;
  requestedById: string;
}

export const SCAN_QUEUE_NAME = "hotel-scan";

let connection: Redis | undefined;
let queue: Queue<HotelScanJobData> | undefined;

/** Connexion Redis partagée — maxRetriesPerRequest: null est requis par BullMQ (cf. sa documentation). */
export function getRedisConnection(redisUrl: string): Redis {
  if (!connection) {
    connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
}

export function getScanQueue(redisUrl: string): Queue<HotelScanJobData> {
  if (!queue) {
    queue = new Queue<HotelScanJobData>(SCAN_QUEUE_NAME, { connection: getRedisConnection(redisUrl) });
  }
  return queue;
}

export async function enqueueHotelScanJob(redisUrl: string, data: HotelScanJobData): Promise<void> {
  await getScanQueue(redisUrl).add("scan-hotel", data, {
    // Pas de retry automatique : un échec Playwright/Expérience est
    // persisté (ScanError) et affiché à l'utilisateur, pas silencieusement
    // rejoué (cohérent avec l'absence de retry sur le scan mono-hôtel de
    // la Phase C).
    attempts: 1
  });
}
