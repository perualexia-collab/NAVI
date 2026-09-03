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
/** Phase F2 — suivi d'action, affiché uniquement pour les signaux sans audience (P01, P05, P08, P12). */
export type RecommendationStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "DISMISSED";
export type PeriodPresetValue = "last12Months" | "thisYear" | "thisMonth" | "lastMonth";
// Dates au format ISO "YYYY-MM-DD".
export type RealScanPeriod = { mode: "preset"; value: PeriodPresetValue } | { mode: "custom"; startDate: string; endDate: string };

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

export interface RealPortfolioHotel extends RealHotel {
  lastScanAt: string | null;
  healthScore: number | null;
  healthLevel: "Critique" | "Fragile" | "Correct" | "Bon" | "Excellent" | null;
  alerts: number | null;
  vigilances: number | null;
  opportunities: number | null;
}

export interface RealPortfolio {
  id: string;
  name: string;
  createdAt: string;
  hotels: RealPortfolioHotel[];
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
  /** Rempli uniquement pour les signaux sans audience (P01, P05, P08, P12) — voir Phase E1. */
  recommendationText: string | null;
  /** Phase E2 — id à passer à api.computeAudience() pour P02/P03/P04/P06/P07/P09. null pour les autres signaux. */
  recommendationId: string | null;
  audienceDefinitionId: string | null;
  /** Dernière mesure connue — null tant que "Calculer l'audience" n'a pas été cliqué. */
  audienceResult: { recipients: number; measuredAt: string } | null;
  /** Phase E3 — uniquement pour P10/P11 (playbookId). null pour les autres signaux. */
  comparison: RealAudienceComparison | null;
  /** Phase F1 — null tant que "Créer la liste dans Expérience" n'a pas été utilisé sur cette recommandation. */
  exportedListName: string | null;
  exportedAt: string | null;
  /** Phase F2 — uniquement pertinent pour les signaux sans audience (audienceMode "NONE"). */
  recommendationStatus: RecommendationStatus | null;
}

export interface RealAudienceComparisonResult {
  id: string;
  audienceDefinitionId: string;
  name: string;
  recipients: number;
  highlighted: boolean;
  /** P11 uniquement — score relatif /100. null pour P10 (pas de score numérique, seule la règle ⭐ s'applique). */
  totalScore: number | null;
  level: string | null;
  /** P11 uniquement — définition compacte du segment, affichée entre parenthèses à côté du nom. null pour P10. */
  description?: string | null;
  /** P10 uniquement — angle/pourquoi-maintenant de la campagne du mois. null pour P11. */
  angle?: string | null;
  whyNow?: string | null;
  /** P10 uniquement — tag d'audience de la campagne (ex. "Loisirs", "Business"), affiché entre parenthèses à côté du nom. */
  audience?: string | null;
}

export interface RealAudienceComparison {
  id: string;
  chosenResultId: string | null;
  results: RealAudienceComparisonResult[];
  /** P10 uniquement. */
  month?: string;
}

/** P10 — statut des automations marketing, condition préalable à "Comparer les audiences". */
export interface RealAutomationStatus {
  status: "UNKNOWN" | "INACTIVE" | "PARTIAL" | "ACTIVE";
  action: "MANUAL_CHECK" | "ACTIVATE_AUTOMATIONS" | "FIX_AUTOMATION_CONFIGURATION" | "SEARCH_PUNCTUAL_CAMPAIGN";
  unexpectedInactive: string[];
}

export interface RealScanSummary {
  scanHotelId: string;
  period: RealScanPeriod;
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
  /** Phase F4 — moyenne d'UNE mesure d'audience (cycle Audience Builder). Une comparaison (E3) en mesure 3 : multiplier par 3 côté affichage. */
  averageAudienceMeasurementDurationMs: number | null;
  latestScan: RealScanSummary | null;
}

/** Phase F3 — ligne d'historique (liste, pas le détail complet). */
export interface RealScanHistoryEntry {
  scanHotelId: string;
  period: RealScanPeriod;
  status: ScanHotelStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  healthScore: number | null;
  healthLevel: string | null;
}

/** Phase F5 — tableau de bord (Accueil), toutes données réelles. */
export interface RealDashboardOpportunity {
  hotelId: string;
  hotelName: string;
  playbookId: string;
  name: string;
  /** "high" uniquement pour P11 avec une opportunité ⭐ (score ≥ 40) — seul vrai signal de priorité du domaine. */
  priority: "high" | "normal";
  recipients: number | null;
  detailLabel: string | null;
}

export interface RealDashboard {
  hotelCount: number;
  portfolioCount: number;
  recentlyScannedCount: number;
  averageHealthScore: number | null;
  criticalAlerts: number;
  vigilances: number;
  opportunityCount: number;
  potentialClients: number;
  recentScans: { hotelId: string; hotelName: string; scannedAt: string; healthScore: number | null }[];
  opportunities: RealDashboardOpportunity[];
}

/** Évènement SSE de progression d'un scan — GET /api/scans/:scanId/events (Phase D2). */
export interface ScanProgressEvent {
  scanId: string;
  total: number;
  completed: number;
  done: boolean;
  etaMs: number | null;
  hotels: { scanHotelId: string; hotelId: string; hotelName: string; status: ScanHotelStatus }[];
}
