/**
 * Catégorisation des signaux — brief §19. Les identifiants de playbook
 * (P01…P12) restent strictement internes ; jamais exposés à l'utilisateur
 * (brief §5, décision produit validée §42).
 */
export type SignalSeverity = "ALERT" | "VIGILANCE" | "OPPORTUNITY";

/**
 * Catalogue statique des 12 signaux — seedé depuis l'onglet
 * "Signals & Playbook" du référentiel Excel. Source de vérité ; le moteur
 * ne réinvente jamais une règle ici.
 */
export interface SignalDefinition {
  /** Identifiant interne de playbook — P01…P12. Ne jamais afficher à l'utilisateur. */
  playbookId: string;
  name: string;
  severity: SignalSeverity;
  conditionDescription: string;
  recommendedAction: string;
  /** "single" = un bouton "Calculer l'audience" ; "multiple" = "Comparer les audiences/opportunités". */
  audienceMode: "none" | "single" | "multiple";
}

export interface SignalResult {
  id: string;
  scanHotelId: string;
  playbookId: string;
  /** Valeur(s) ayant déclenché le signal, pour affichage du "pourquoi". */
  trigger: string;
  detectedAt: string;
}
