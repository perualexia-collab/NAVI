/**
 * Modèle d'audience validé (échange du 2026-09-01) : calcul direct pour une
 * option unique, comparaison de plusieurs audiences avant choix pour les
 * signaux à options multiples (P10, P11).
 */
export interface AudienceDefinition {
  id: string;
  name: string;
  description: string;
  playbookIds: string[];
}

export interface AudienceResult {
  id: string;
  hotelId: string;
  audienceDefinitionId: string;
  /** Regroupe ce résultat avec d'autres options comparées ensemble — null pour une audience calculée seule. */
  comparisonId: string | null;
  recipients: number;
  /** Marquage ⭐ (ex. règle P10 : audience qui répond directement à une faiblesse du diagnostic). */
  highlighted: boolean;
  measuredAt: string;
}

export interface AudienceComparison {
  id: string;
  hotelId: string;
  playbookId: string;
  results: AudienceResult[];
  chosenResultId: string | null;
}

export interface Recommendation {
  id: string;
  scanHotelId: string;
  signalResultId: string;
  text: string;
  /** null si aucune audience associée (ex. P01, P05, P08, P12). */
  audienceDefinitionId: string | null;
}
