import type { Period } from "./common.js";

/**
 * Statut individuel d'un hôtel dans un scan — brief §12.
 * PARTIAL_SUCCESS : au moins une donnée récupérée mais pas toutes.
 */
export type ScanHotelStatus = "PENDING" | "RUNNING" | "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";

export type StepStatus = "PENDING" | "RUNNING" | "OK" | "ERROR" | "SKIPPED";

/**
 * Une étape de collecte KPI dans Expérience — un scraper du moteur.
 * Le détail par étape (plutôt qu'un statut unique par hôtel) est ce qui
 * permet d'afficher "✓ Chiffre d'affaires · ✕ KPI Y" (brief §12).
 */
export type ScanStepName = "BASE" | "CAPTURE" | "OTA" | "RETURNING" | "MARKETING";

/**
 * Types d'erreur technique — brief §12. L'utilisateur ne voit jamais le
 * message Playwright brut ; ces types alimentent une traduction métier.
 */
export type ScanErrorType =
  | "TIMEOUT"
  | "ELEMENT_NOT_FOUND"
  | "PAGE_UNAVAILABLE"
  | "AUTHENTICATION_ERROR"
  | "HOTEL_NOT_FOUND"
  | "NAVIGATION_ERROR"
  | "UNKNOWN_ERROR";

export interface ScanStep {
  id: string;
  scanHotelId: string;
  name: ScanStepName;
  status: StepStatus;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ScanError {
  id: string;
  scanHotelId: string;
  stepName: ScanStepName;
  errorType: ScanErrorType;
  /** Message métier compréhensible, ex. "Le chiffre d'affaires n'a pas pu être récupéré dans Expérience." */
  userMessage: string;
  /** Message technique complet — logs uniquement, jamais affiché à l'utilisateur. */
  technicalMessage: string;
  occurredAt: string;
}

export interface Scan {
  id: string;
  portfolioId: string | null;
  requestedById: string;
  period: Period;
  startedAt: string;
  finishedAt: string | null;
}

export interface ScanHotel {
  id: string;
  scanId: string;
  hotelId: string;
  status: ScanHotelStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  attempt: number;
  healthScore: number | null;
  healthLevel: string | null;
  steps: ScanStep[];
  errors: ScanError[];
}
