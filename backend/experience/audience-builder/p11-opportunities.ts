import type { AudienceFilter } from "./definitions.js";

/**
 * P11 — Opportunity Finder : les 3 opportunités comparées, portées depuis
 * `P11_OPPORTUNITIES` (docs/reference/moteur-experience-existant.js, bloc
 * 1/8). `potentialScore`/`actionabilityScore` sont des poids fixes du
 * référentiel (scoring relatif P11 — 30/20 pts selon la définition,
 * complétés par un score de volume relatif calculé sur le nombre de
 * destinataires mesuré).
 *
 * `id` diffère volontairement du script d'origine (`ONETIMER`/`REPEATER`/`OTA`)
 * : aligné ici sur `backend/prisma/seed-data/audience-definitions.ts`
 * (`P11_ONETIMER`/`P11_REPEATER`/`P11_OTA`), la vraie clé étrangère
 * `AudienceResult.audienceDefinitionId` en base.
 */
export interface P11Opportunity {
  id: string;
  name: string;
  description: string;
  potentialScore: number;
  actionabilityScore: number;
  filters: AudienceFilter[];
}

export const P11_OPPORTUNITIES: P11Opportunity[] = [
  {
    id: "P11_ONETIMER",
    name: "One-timers à réactiver",
    description: "Clients venus une seule fois et non revenus depuis 12 à 36 mois.",
    potentialScore: 15,
    actionabilityScore: 15,
    filters: [
      { field: "stayCount", operator: "=", value: 1 },
      { field: "lastStayDate", operator: "between", relativeMonthsFrom: 36, relativeMonthsTo: 12 }
    ]
  },
  {
    id: "P11_REPEATER",
    name: "Repeaters dormants",
    description: "Clients ayant déjà séjourné au moins deux fois mais absents depuis 18 à 36 mois.",
    potentialScore: 30,
    actionabilityScore: 20,
    filters: [
      { field: "stayCount", operator: ">=", value: 2 },
      { field: "lastStayDate", operator: "between", relativeMonthsFrom: 36, relativeMonthsTo: 18 }
    ]
  },
  {
    id: "P11_OTA",
    name: "OTA convertibles",
    description: "Repeaters dont le dernier séjour provient de Booking ou Expedia.",
    potentialScore: 25,
    actionabilityScore: 20,
    filters: [
      { field: "stayCount", operator: ">=", value: 2 },
      { field: "lastStayChannel" },
      { field: "lastStayDate", operator: ">=", relativeMonths: 36 }
    ]
  }
];
