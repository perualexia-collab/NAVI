/**
 * Rôles NAVI — brief §7. Les permissions sont vérifiées côté backend, jamais
 * seulement côté interface.
 */
export type Role = "ADMIN" | "USER";

/**
 * Période d'analyse transmise par le frontend — brief §18.
 * Reprend, autant que possible, la logique de périodes d'Expérience.
 */
export type Period =
  | { type: "preset"; value: "LAST_3_MONTHS" | "LAST_6_MONTHS" | "LAST_12_MONTHS" | "CURRENT_YEAR" | "PREVIOUS_YEAR" }
  | { type: "custom"; startDate: string; endDate: string };

/**
 * États UI obligatoires — brief §36. Toute zone de donnée doit pouvoir
 * représenter ces états explicitement, jamais un vide silencieux.
 */
export type LoadState = "LOADING" | "EMPTY" | "SUCCESS" | "PARTIAL_SUCCESS" | "ERROR";
