/**
 * Catalogue KPI — transcrit depuis l'onglet "Cartographie KPIs" du
 * référentiel Excel (docs/reference/referentiel-metier-navi.xlsx).
 *
 * dateFilterable encode le comportement RÉEL observé dans le moteur
 * existant (docs/reference/moteur-experience-existant.js), pas seulement
 * la colonne "Période ?" du référentiel : les KPI OTA et Returning Guests
 * comparent toujours année N vs N-1, indépendamment de la période choisie
 * pour le scan — voir NAVI Architecture Proposal §03.
 */
export interface KPIDefinitionSeed {
  id: string;
  label: string;
  source: string;
  dateFilterable: boolean;
  version: "V1" | "V2";
  scraped: boolean;
}

export const kpiDefinitions: KPIDefinitionSeed[] = [
  { id: "totalProfiles", label: "Taille de la base", source: "Analyse base client → Général", dateFilterable: true, version: "V1", scraped: true },
  { id: "usableEmails", label: "Emails utilisables", source: "Analyse base client → Général", dateFilterable: true, version: "V1", scraped: true },
  { id: "emailCaptureRate", label: "Taux de captation e-mail", source: "Activité", dateFilterable: true, version: "V1", scraped: true },
  { id: "otaAgencyEmailShare", label: "% e-mails OTA / agences", source: "Analyse base client → Général", dateFilterable: true, version: "V1", scraped: true },
  { id: "unsubscribedShare", label: "Désinscrits", source: "Analyse base client → Général", dateFilterable: true, version: "V1", scraped: true },
  { id: "otaBookingReservationShare", label: "Part des réservations OTA Booking", source: "Revenu → OTA", dateFilterable: false, version: "V1", scraped: true },
  { id: "otaBookingRevenueShare", label: "Part du CA OTA Booking", source: "Revenu → OTA", dateFilterable: false, version: "V1", scraped: true },
  { id: "otaExpediaReservationShare", label: "Part des réservations OTA Expedia", source: "Revenu → OTA", dateFilterable: false, version: "V1", scraped: true },
  { id: "otaExpediaRevenueShare", label: "Part du CA OTA Expedia", source: "Revenu → OTA", dateFilterable: false, version: "V1", scraped: true },
  { id: "nonOtaReservationShare", label: "Part des réservations Non OTA", source: "Revenu → OTA", dateFilterable: false, version: "V1", scraped: true },
  { id: "nonOtaRevenueShare", label: "Part du CA Non OTA", source: "Revenu → OTA", dateFilterable: false, version: "V1", scraped: true },
  { id: "returningGuestsRate", label: "Returning Guests", source: "Revenu → Returning Guests", dateFilterable: false, version: "V1", scraped: true },
  { id: "crmRevenue", label: "CA CRM", source: "Statistiques Marketing", dateFilterable: true, version: "V1", scraped: true },
  { id: "crmBookings", label: "Réservations CRM", source: "Statistiques Marketing", dateFilterable: true, version: "V1", scraped: true },
  { id: "emailSendCount", label: "Nombre d'envois", source: "Statistiques Marketing", dateFilterable: true, version: "V2", scraped: false },
  { id: "automationRevenue", label: "CA par automation", source: "Statistiques Marketing", dateFilterable: true, version: "V1", scraped: true },
  { id: "automationBookings", label: "Réservations par automation", source: "Statistiques Marketing", dateFilterable: true, version: "V1", scraped: true },
  { id: "campaignRevenue", label: "CA par campagne ponctuelle", source: "Statistiques Marketing", dateFilterable: true, version: "V1", scraped: true },
  { id: "campaignBookings", label: "Réservations par campagne ponctuelle", source: "Statistiques Marketing", dateFilterable: true, version: "V1", scraped: true },
  { id: "globalSatisfaction", label: "Satisfaction globale", source: "Activité / Satisfaction", dateFilterable: true, version: "V2", scraped: false },
  { id: "reputationScores", label: "Notes e-réputation principales", source: "E-réputation", dateFilterable: true, version: "V2", scraped: false },
  { id: "averageSpendPerBooking", label: "Dépense moyenne par réservation", source: "Analyse base client → Profils", dateFilterable: true, version: "V1", scraped: true }
];
