/**
 * Configuration du moteur Expérience — porté depuis
 * docs/reference/moteur-experience-existant.js (bloc 1/8 et 2/8).
 */

export const EXPERIENCE_BASE_URL = "https://crm.experience-hotel.com/";

/**
 * Préréglages de période — libellés exacts attendus par le sélecteur de
 * période d'Expérience. "3/6/12 derniers mois" portés depuis le script
 * existant ; "Cette année"/"Ce mois-ci"/"Le mois dernier" ajoutés le
 * 2026-09-02 d'après une capture d'écran réelle du sélecteur "Déterminer
 * un préréglage" d'Expérience (docs/reference/phase-d-notes.md) —
 * "L'année dernière", aussi visible sur cette capture, volontairement
 * exclu (non demandé). Les boutons Expérience s'affichent en majuscules
 * (CSS), mais Playwright cible le contenu DOM réel (casse normale) ; la
 * correspondance `getByRole("button", { name: label, exact: false })`
 * est de toute façon insensible à la casse.
 *
 * Note ouverte : cette capture ne montrait PAS "3 derniers mois"/"6
 * derniers mois" parmi les préréglages proposés — peut-être un sélecteur
 * différent de celui réellement ciblé par applyPeriodWithToggle()/
 * setMarketingPeriod(), peut-être une indication que ces deux préréglages
 * n'existent pas vraiment. Conservés ici par prudence (jamais vus en
 * échec) plutôt que supprimés sans certitude — à trancher si un scan réel
 * sur 3 ou 6 mois échoue à ce niveau précis.
 */
export const PERIOD_PRESETS = {
  last3Months: "3 derniers mois",
  last6Months: "6 derniers mois",
  last12Months: "12 derniers mois",
  thisYear: "Cette année",
  thisMonth: "Ce mois-ci",
  lastMonth: "Le mois dernier"
} as const;

export type PeriodPresetValue = keyof typeof PERIOD_PRESETS;

export interface ScanPeriod {
  mode: "preset";
  value: PeriodPresetValue;
}
