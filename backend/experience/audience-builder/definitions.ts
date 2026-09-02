/**
 * Catalogue des définitions d'audience — porté à l'identique depuis
 * docs/reference/moteur-experience-existant.js (bloc 5/8, `AUDIENCE_DEFINITIONS`).
 * Une seule source de vérité pour les filtres réellement appliqués dans
 * Expérience par P02/P03/P04 (RISK_INACTIVITY), P06 (OTA_CONVERTIBLE), P07
 * (SECOND_BOOKING) et P09 (HIGH_VALUE_ONE_TIMER) — Phase E2.
 *
 * Les `id` ci-dessous doivent rester alignés avec
 * backend/prisma/seed-data/audience-definitions.ts (catalogue DB —
 * id/name/description, affiché à l'utilisateur) : ce fichier-ci ne porte
 * que ce que Playwright a besoin de savoir pour construire le filtre.
 */

export type AudienceFilter =
  | { field: "stayCount"; operator: "=" | ">="; value: number }
  | { field: "lastStayChannel" }
  | { field: "lastStayDate"; operator: ">="; relativeMonths: number }
  | { field: "lastStayDate"; operator: "between"; relativeMonthsFrom: number; relativeMonthsTo: number }
  | { field: "emailNotOpenedSince"; relativeMonths: number }
  | { field: "stayAmount"; operator: "=" | ">="; value?: number; dynamicValue?: "averageSpend" };

export interface AudienceDefinitionConfig {
  id: string;
  name: string;
  filters: AudienceFilter[];
}

export const AUDIENCE_DEFINITIONS: Record<string, AudienceDefinitionConfig> = {
  RISK_INACTIVITY: {
    id: "RISK_INACTIVITY",
    name: "Profils à risque d'inactivité",
    filters: [
      { field: "emailNotOpenedSince", relativeMonths: 12 },
      { field: "lastStayDate", operator: ">=", relativeMonths: 36 }
    ]
  },
  OTA_CONVERTIBLE: {
    id: "OTA_CONVERTIBLE",
    name: "OTA convertibles",
    filters: [
      { field: "stayCount", operator: ">=", value: 2 },
      { field: "lastStayChannel" },
      { field: "lastStayDate", operator: ">=", relativeMonths: 36 }
    ]
  },
  SECOND_BOOKING: {
    id: "SECOND_BOOKING",
    name: "Deuxième réservation",
    filters: [
      { field: "stayCount", operator: "=", value: 1 },
      { field: "lastStayDate", operator: "between", relativeMonthsFrom: 18, relativeMonthsTo: 3 }
    ]
  },
  HIGH_VALUE_ONE_TIMER: {
    id: "HIGH_VALUE_ONE_TIMER",
    name: "One-timers à forte valeur",
    filters: [
      { field: "stayCount", operator: "=", value: 1 },
      { field: "lastStayDate", operator: ">=", relativeMonths: 12 },
      { field: "stayAmount", operator: ">=", dynamicValue: "averageSpend" }
    ]
  }
};

/** P02/P03/P04/P06/P07/P09 (audienceMode SINGLE) → AudienceDefinitionConfig.id — porté depuis PLAYBOOKS (bloc 1/8). */
export const AUDIENCE_DEFINITION_ID_BY_PLAYBOOK: Record<string, string | undefined> = {
  P02: "RISK_INACTIVITY",
  P03: "RISK_INACTIVITY",
  P04: "RISK_INACTIVITY",
  P06: "OTA_CONVERTIBLE",
  P07: "SECOND_BOOKING",
  P09: "HIGH_VALUE_ONE_TIMER"
};
