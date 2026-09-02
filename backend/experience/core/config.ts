/**
 * Configuration du moteur Expérience — porté depuis
 * docs/reference/moteur-experience-existant.js (bloc 1/8 et 2/8).
 */

export const EXPERIENCE_BASE_URL = "https://crm.experience-hotel.com/";

/**
 * Préréglages de période — libellés exacts attendus par le sélecteur de
 * période d'Expérience, confirmés le 2026-09-02 d'après une capture
 * d'écran réelle du sélecteur "Déterminer un préréglage" (voir
 * docs/reference/phase-d-notes.md). "L'année dernière", aussi visible
 * sur cette capture, volontairement exclu (non demandé). "3/6 derniers
 * mois", jamais vus dans cette capture et jamais confirmés séparément,
 * retirés le 2026-09-02 sur demande explicite (la période personnalisée
 * couvre ce besoin). Les boutons Expérience s'affichent en majuscules
 * (CSS), mais Playwright cible le contenu DOM réel (casse normale) ; la
 * correspondance `getByRole("button", { name: label, exact: false })`
 * est de toute façon insensible à la casse.
 */
export const PERIOD_PRESETS = {
  last12Months: "12 derniers mois",
  thisYear: "Cette année",
  thisMonth: "Ce mois-ci",
  lastMonth: "Le mois dernier"
} as const;

export type PeriodPresetValue = keyof typeof PERIOD_PRESETS;

export type ScanPeriod =
  | { mode: "preset"; value: PeriodPresetValue }
  // Dates au format ISO "YYYY-MM-DD". Remplit la section "Plage de date"
  // (Début/Fin) du même panneau Expérience que les préréglages — jamais
  // vérifié contre le vrai DOM (capture d'écran uniquement, 2026-09-02) :
  // l'affichage "03 SEP 2023" suggère un widget de saisie personnalisé,
  // pas un <input type="date"> natif. Voir fillCustomDateRange()
  // (backend/experience/core/navigation.ts) et
  // docs/reference/phase-d-notes.md pour le détail de cette hypothèse.
  | { mode: "custom"; startDate: string; endDate: string };
