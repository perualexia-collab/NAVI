import type { StepStatus } from "@navi/shared";
import { prisma } from "../src/db/prisma.js";
import type { ScanPeriod } from "../experience/core/config.js";
import { STEP_NAMES } from "./run-hotel-scan.js";
import { enqueueHotelScanJob } from "./queue.js";

export interface LaunchPortfolioScanOptions {
  portfolioId: string;
  period: ScanPeriod;
  requestedById: string;
  redisUrl: string;
}

export interface LaunchPortfolioScanResult {
  scanId: string;
  scanHotelIds: string[];
}

/**
 * Lance un scan pour tous les hôtels d'un portefeuille — Phase D1. Un seul
 * `Scan` (portfolioId renseigné), un `ScanHotel` PENDING par hôtel, un job
 * BullMQ indépendant par hôtel : un hôtel qui échoue n'empêche jamais les
 * autres de tourner (isolation native de la queue — chaque job a son
 * propre cycle de vie). Retourne immédiatement (les scans tournent en
 * arrière-plan) ; pas de progression temps réel ici, c'est la Phase D2.
 */
export async function launchPortfolioScan(options: LaunchPortfolioScanOptions): Promise<LaunchPortfolioScanResult> {
  const portfolio = await prisma.portfolio.findUniqueOrThrow({
    where: { id: options.portfolioId },
    include: { hotels: true }
  });

  if (portfolio.hotels.length === 0) {
    throw new Error("Portefeuille vide — aucun hôtel à scanner.");
  }

  const scan = await prisma.scan.create({
    data: {
      portfolioId: portfolio.id,
      requestedById: options.requestedById,
      period: options.period as object
    }
  });

  const scanHotels = await Promise.all(
    portfolio.hotels.map((ph) =>
      prisma.scanHotel.create({
        data: {
          scanId: scan.id,
          hotelId: ph.hotelId,
          status: "PENDING",
          steps: { create: STEP_NAMES.map((name) => ({ name, status: "PENDING" as StepStatus })) }
        }
      })
    )
  );

  await Promise.all(
    scanHotels.map((scanHotel) =>
      enqueueHotelScanJob(options.redisUrl, {
        scanId: scan.id,
        scanHotelId: scanHotel.id,
        hotelId: scanHotel.hotelId,
        period: options.period,
        requestedById: options.requestedById
      })
    )
  );

  return { scanId: scan.id, scanHotelIds: scanHotels.map((s) => s.id) };
}
