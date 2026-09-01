/**
 * Configuration du moteur Expérience — porté depuis
 * docs/reference/moteur-experience-existant.js (bloc 1/8 et 2/8).
 */

export const EXPERIENCE_BASE_URL = "https://crm.experience-hotel.com/";

/**
 * Préréglages de période — libellés exacts attendus par le sélecteur de
 * période d'Expérience. Seuls les 3 préréglages déjà validés dans le
 * script existant sont portés ici ; "Année en cours" / "Année précédente" /
 * période personnalisée (brief §18) restent à valider contre le
 * comportement réel d'Expérience avant d'être ajoutés — ne pas deviner
 * leur libellé exact.
 */
export const PERIOD_PRESETS = {
  last3Months: "3 derniers mois",
  last6Months: "6 derniers mois",
  last12Months: "12 derniers mois"
} as const;

export type PeriodPresetValue = keyof typeof PERIOD_PRESETS;

export interface ScanPeriod {
  mode: "preset";
  value: PeriodPresetValue;
}
