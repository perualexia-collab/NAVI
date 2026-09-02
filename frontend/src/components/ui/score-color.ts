/**
 * Couleur sémantique d'un score CRM Health. Seuils alignés sur
 * getHealthLevel() (backend/src/services/scoring/crm-health.ts) regroupé
 * sur 3 teintes — Critique (<40) → alert, Fragile (40-59) → warn,
 * Correct/Bon/Excellent (≥60) → sage — pour que l'anneau de score et
 * l'étiquette de statut (StatusPill, dérivée de la même healthLevel)
 * affichent toujours la même couleur. Retours réels Phase D
 * (2026-09-02) : un ancien seuil à 60/75 faisait apparaître un anneau
 * rouge à côté d'une étiquette "À surveiller" jaune pour un score
 * "Fragile" (40-59).
 */
export function scoreTone(score: number | null): "sage" | "warn" | "alert" | "muted" {
  if (score === null) return "muted";
  if (score >= 60) return "sage";
  if (score >= 40) return "warn";
  return "alert";
}

export const toneHex: Record<"sage" | "warn" | "alert" | "muted", string> = {
  sage: "#5c7455",
  warn: "#a97620",
  alert: "#a13a2b",
  muted: "#c9c2ae"
};
