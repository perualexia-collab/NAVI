/**
 * Catalogue statique des KPI — seedé depuis l'onglet "Cartographie KPIs"
 * du référentiel Excel. dateFilterable porte la nuance du brief §18 :
 * OTA et Returning Guests comparent toujours année N vs N-1, indépendamment
 * de la période sélectionnée pour le scan — ne jamais laisser croire le contraire.
 */
export interface KPIDefinition {
  id: string;
  label: string;
  source: string;
  dateFilterable: boolean;
  version: "V1" | "V2";
  scraped: boolean;
}

export interface KPIResult {
  id: string;
  scanHotelId: string;
  kpiDefinitionId: string;
  value: number | null;
  /** null = donnée non applicable ; distinct de value=0 (brief §37). */
  available: boolean;
}
