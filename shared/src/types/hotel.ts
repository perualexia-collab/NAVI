/**
 * Statut d'un hôtel côté Expérience — brief §24. Un hôtel n'est "Actif" que
 * si testHotelConnection() a réellement validé son accès dans Expérience ;
 * la seule saisie d'un nom ne suffit jamais.
 */
export type HotelExperienceStatus = "ACTIVE" | "TO_VERIFY" | "NOT_FOUND" | "ERROR";

export interface Hotel {
  id: string;
  name: string;
  experienceLabel: string;
  city: string | null;
  starRating: number | null;
  roomCount: number | null;
  experienceStatus: HotelExperienceStatus;
  disabled: boolean;
  lastConnectionCheckAt: string | null;
}
