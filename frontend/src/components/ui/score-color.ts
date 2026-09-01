/** Couleur sémantique d'un score CRM Health — cohérente avec les 5 niveaux du référentiel (backend/src/services/scoring). */
export function scoreTone(score: number | null): "sage" | "warn" | "alert" | "muted" {
  if (score === null) return "muted";
  if (score >= 75) return "sage";
  if (score >= 60) return "warn";
  return "alert";
}

export const toneHex: Record<"sage" | "warn" | "alert" | "muted", string> = {
  sage: "#5c7455",
  warn: "#a97620",
  alert: "#a13a2b",
  muted: "#c9c2ae"
};
