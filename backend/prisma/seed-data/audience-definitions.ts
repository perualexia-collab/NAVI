/**
 * Catalogue des audiences — transcrit du moteur existant
 * (AUDIENCE_DEFINITIONS et P11_OPPORTUNITIES dans
 * docs/reference/moteur-experience-existant.js, blocs 1/8 et 6/8),
 * lui-même conforme aux onglets "Signals & Playbook" et "P11" du
 * référentiel. Les filtres concrets (dates relatives, opérateurs) restent
 * dans le moteur Playwright (backend/experience) — cette table ne porte
 * que ce qui est utile à l'affichage NAVI.
 */
export interface AudienceDefinitionSeed {
  id: string;
  name: string;
  description: string;
}

export const audienceDefinitions: AudienceDefinitionSeed[] = [
  {
    id: "RISK_INACTIVITY",
    name: "Profils à risque d'inactivité",
    description: "Aucun e-mail ouvert depuis ≥ 12 mois, dernier séjour il y a moins de 36 mois. (P02, P03, P04)"
  },
  {
    id: "OTA_CONVERTIBLE",
    name: "OTA convertibles",
    description: "≥ 2 séjours, dernier séjour via Booking/Expedia, dernier séjour il y a moins de 36 mois. (P06)"
  },
  {
    id: "SECOND_BOOKING",
    name: "Deuxième réservation",
    description: "Exactement 1 séjour, dernier séjour entre 3 et 18 mois. (P07)"
  },
  {
    id: "HIGH_VALUE_ONE_TIMER",
    name: "One-timers à forte valeur",
    description: "Exactement 1 séjour, dernier séjour il y a moins de 12 mois, montant ≥ dépense moyenne par réservation de l'hôtel. (P09)"
  },
  {
    id: "P11_ONETIMER",
    name: "One-timers à réactiver",
    description: "1 séjour, dernier séjour entre 12 et 36 mois. (P11)"
  },
  {
    id: "P11_REPEATER",
    name: "Repeaters dormants",
    description: "≥ 2 séjours, dernier séjour entre 18 et 36 mois. (P11)"
  },
  {
    id: "P11_OTA",
    name: "OTA convertibles (P11)",
    description: "≥ 2 séjours, dernier séjour via Booking/Expedia, dernier séjour il y a moins de 36 mois. (P11)"
  }
];
