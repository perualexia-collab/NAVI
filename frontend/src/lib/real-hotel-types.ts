/**
 * Formes de réponse de l'API réelle (backend/src/api/routes/hotels.ts) —
 * distinctes des types @navi/shared "de référence" tant que l'API n'est
 * pas stabilisée. Un seul hôtel (le pilote du vertical slice) les utilise
 * pour l'instant ; tous les autres écrans restent sur les données mockées
 * de src/mock/.
 */
export type ExperienceStatus = "ACTIVE" | "TO_VERIFY" | "NOT_FOUND" | "ERROR";
export type ScanHotelStatus = "PENDING" | "RUNNING" | "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";
export type StepStatus = "PENDING" | "RUNNING" | "OK" | "ERROR" | "SKIPPED";
export type ScanStepName = "BASE" | "CAPTURE" | "OTA" | "RETURNING" | "MARKETING";
export type SignalSeverity = "ALERT" | "VIGILANCE" | "OPPORTUNITY";
export type AudienceMode = "NONE" | "SINGLE" | "MULTIPLE";
export type ScanPeriodValue = "last3Months" | "last6Months" | "last12Months";

export interface RealHotel {
  id: string;
  name: string;
  experienceLabel: string;
  // Identifiant stable côté Expérience — renseigné une fois la vérification
  // Playwright effectuée (pas encore implémentée, retours Phase C.5 §2).
  experienceHotelId: string | null;
  experienceStatus: ExperienceStatus;
  disabled: boolean;
  lastConnectionCheckAt: string | null;
}

export interface RealPortfolio {
  id: string;
  name: string;
  createdAt: string;
  hotels: RealHotel[];
  health: {
    scannedCount: number;
    toScanCount: number;
    criticalCount: number;
    healthScore: number | null;
  };
}

export type UserStatus = "PENDING" | "ACTIVE" | "DISABLED";

export interface RealUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
  status: UserStatus;
  createdAt: string;
}

export interface RealKpiResult {
  kpiDefinitionId: string;
  label: string;
  dateFilterable: boolean;
  value: number | null;
  available: boolean;
  previousValue: number | null;
  evolutionPoints: number | null;
}

export interface RealSignalResult {
  playbookId: string;
  name: string;
  severity: SignalSeverity;
  trigger: string;
  recommendedAction: string;
  audienceMode: AudienceMode;
}

export interface RealScanSummary {
  scanHotelId: string;
  status: ScanHotelStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  healthScore: number | null;
  healthLevel: string | null;
  scoreBreakdown: { base: number | null; capture: number | null; ota: number | null; loyalty: number | null; activation: number | null };
  activationRate: number | null;
  steps: { name: ScanStepName; status: StepStatus }[];
  errors: { stepName: ScanStepName; errorType: string; userMessage: string; occurredAt: string }[];
  kpiResults: RealKpiResult[];
  signalResults: RealSignalResult[];
}

export interface RealHotelHealth {
  hotel: RealHotel;
  scanCount: number;
  averageScanDurationMs: number | null;
  latestScan: RealScanSummary | null;
}
