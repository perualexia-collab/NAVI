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
  // Identifiant stable côté Expérience, renseigné une fois la vérification
  // Playwright effectuée (retours Phase C.5, §2 — vérification elle-même
  // hors scope de cette passe) : évite de re-résoudre la correspondance de
  // nom à chaque scan.
  experienceHotelId: string | null;
  experienceStatus: HotelExperienceStatus;
  disabled: boolean;
  lastConnectionCheckAt: string | null;
}
