/**
 * Moteur de scoring CRM Health — porté à l'identique depuis
 * docs/reference/moteur-experience-existant.js (bloc 1/8, fonctions
 * calculateCRMHealth / interpolateScore / getHealthLevel).
 *
 * Fonctions pures, aucune dépendance Playwright. Seuils et pondérations
 * conformes à l'onglet "Scoring CRM" du référentiel Excel — ne pas modifier
 * sans mettre à jour le référentiel en premier (brief §20 : le scoring ne
 * doit pas être reconstruit arbitrairement).
 */

export interface CRMHealthInput {
  activabilityRate: number | null;
  captureRate: number | null;
  nonOtaRate: number | null;
  returningRate: number | null;
  activationRate: number | null;
}

export interface CRMHealthScore {
  baseScore: number;
  captureScore: number;
  otaScore: number;
  loyaltyScore: number;
  activationScore: number;
  totalScore: number;
}

function round2(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 0;
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Interpolation linéaire par segments entre points de barème (ex: [[30,5],[50,10]]). */
function interpolateScore(value: number | null, points: Array<[number, number]>): number {
  if (!Number.isFinite(Number(value))) return 0;
  const numeric = Number(value);

  if (numeric <= points[0]![0]) return points[0]![1];
  const last = points[points.length - 1]!;
  if (numeric >= last[0]) return last[1];

  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[i + 1]!;
    if (numeric >= x1 && numeric <= x2) {
      const ratio = (numeric - x1) / (x2 - x1);
      return y1 + ratio * (y2 - y1);
    }
  }
  return 0;
}

export function calculateCRMHealth({
  activabilityRate,
  captureRate,
  nonOtaRate,
  returningRate,
  activationRate
}: CRMHealthInput): CRMHealthScore {
  const baseScore = interpolateScore(activabilityRate, [
    [0, 0],
    [30, 5],
    [50, 10],
    [70, 15],
    [90, 20]
  ]);

  const captureScore = interpolateScore(captureRate, [
    [40, 0],
    [60, 3.75],
    [70, 7.5],
    [80, 11.25],
    [95, 15]
  ]);

  const otaScore = interpolateScore(nonOtaRate, [
    [10, 0],
    [22.5, 5],
    [35, 10],
    [47.5, 15],
    [60, 20]
  ]);

  const loyaltyScore = interpolateScore(returningRate, [
    [0, 0],
    [5, 5],
    [8, 10],
    [12, 15],
    [15, 20]
  ]);

  const activationScore = interpolateScore(activationRate, [
    [0, 0],
    [8, 6.25],
    [18, 12.5],
    [33, 18.75],
    [45, 25]
  ]);

  const totalScore = clamp(baseScore + captureScore + otaScore + loyaltyScore + activationScore, 0, 100);

  return {
    baseScore: round2(baseScore),
    captureScore: round2(captureScore),
    otaScore: round2(otaScore),
    loyaltyScore: round2(loyaltyScore),
    activationScore: round2(activationScore),
    totalScore: round2(totalScore)
  };
}

// Seuils Bon/Excellent resserrés à la demande explicite du 2026-09-03
// (75-88 = Bon, 89-100 = Excellent) — Critique/Fragile/Correct inchangés.
export function getHealthLevel(score: number): "Critique" | "Fragile" | "Correct" | "Bon" | "Excellent" {
  if (score < 40) return "Critique";
  if (score < 60) return "Fragile";
  if (score < 75) return "Correct";
  if (score < 89) return "Bon";
  return "Excellent";
}

export function calculateActivationRate(totalCrmBookings: number | null, usableEmails: number | null): number | null {
  if (
    !Number.isFinite(Number(totalCrmBookings)) ||
    !Number.isFinite(Number(usableEmails)) ||
    Number(usableEmails) <= 0
  ) {
    return null;
  }
  return round2((Number(totalCrmBookings) / Number(usableEmails)) * 1000);
}
