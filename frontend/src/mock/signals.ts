/**
 * Catalogue des signaux — dupliqué depuis backend/prisma/seed-data/signal-definitions.ts
 * (lui-même transcrit de l'onglet "Signals & Playbook" du référentiel Excel).
 * Le texte de chaque signal est réel ; l'association à un hôtel précis reste
 * illustrative tant que le moteur de détection n'est pas branché (Phase C/E)
 * — voir backend/src/services/signals/detect-signals.ts.
 *
 * TODO Phase C : remplacer cette duplication par un vrai appel API
 * (GET /api/signals/catalogue) une fois le backend exposé au frontend.
 */
export interface SignalCatalogueEntry {
  playbookId: string;
  name: string;
  severity: "ALERT" | "VIGILANCE" | "OPPORTUNITY";
  conditionDescription: string;
  recommendedAction: string;
  audienceMode: "NONE" | "SINGLE" | "MULTIPLE";
}

export const signalCatalogue: SignalCatalogueEntry[] = [
  { playbookId: "P01", name: "Captation insuffisante", severity: "ALERT", conditionDescription: "Taux de captation e-mail < 60 %", recommendedAction: "Faire un point avec les équipes opérationnelles sur le process de captation.", audienceMode: "NONE" },
  { playbookId: "P07", name: "Faible fidélisation", severity: "ALERT", conditionDescription: "Returning Guests < 5 %", recommendedAction: "Travailler les clients venus une seule fois avec une vraie raison de revenir.", audienceMode: "SINGLE" },
  { playbookId: "P10", name: "Sous-activation CRM", severity: "ALERT", conditionDescription: "Activation CRM < 8 réservations / 1 000 profils activables", recommendedAction: "Vérifier les automations puis identifier une campagne pertinente pour la période.", audienceMode: "MULTIPLE" },
  { playbookId: "P08", name: "Fidélisation en recul", severity: "VIGILANCE", conditionDescription: "Évolution Returning Guests ≤ −2 pts vs N-1", recommendedAction: "Contextualiser la baisse avec les autres signaux avant toute action.", audienceMode: "NONE" },
  { playbookId: "P12", name: "Business CRM concentré sur les automations", severity: "VIGILANCE", conditionDescription: "Part automations ≥ 80 % ET réservations CRM ≥ 10", recommendedAction: "Vérifier s'il existe une opportunité de campagne ponctuelle complémentaire.", audienceMode: "NONE" },
  { playbookId: "P06", name: "Potentiel OTA → Direct", severity: "OPPORTUNITY", conditionDescription: "Non OTA ≤ 30 % ET Returning Guests ≥ 7 %", recommendedAction: "Campagne mettant en avant le code fidélité et le gap tarifaire OTA/direct.", audienceMode: "SINGLE" },
  { playbookId: "P09", name: "Potentiel de fidélisation inexploité", severity: "OPPORTUNITY", conditionDescription: "Returning Guests < 7 % ET Activabilité ≥ 50 % ET Activation ≥ 18 ‰", recommendedAction: "Cibler les one-timers à plus fort potentiel avec code fidélité personnalisé.", audienceMode: "SINGLE" },
  { playbookId: "P11", name: "Base CRM sous-exploitée", severity: "OPPORTUNITY", conditionDescription: "Activabilité ≥ 50 % ET Activation CRM < 8 ‰", recommendedAction: "Rechercher plusieurs segments exploitables et proposer les plus intéressants.", audienceMode: "MULTIPLE" }
];

export interface MockAudienceOption {
  name: string;
  recipients: number;
  highlighted?: boolean;
}

/** Comparaison mockée — illustre le modèle validé "Comparer les audiences/opportunités" avant choix. */
export const mockAudienceComparisons: Record<string, MockAudienceOption[]> = {
  P10: [
    { name: "Repeaters", recipients: 1842, highlighted: true },
    { name: "Clientèle nationale", recipients: 623 },
    { name: "Loisirs", recipients: 97 }
  ],
  P11: [
    { name: "Repeaters dormants", recipients: 940, highlighted: true },
    { name: "One-timers à réactiver", recipients: 612 },
    { name: "OTA convertibles", recipients: 388 }
  ]
};

export const mockAudienceHistory = [
  { name: "Profils à risque d'inactivité", recipients: 214, measuredAt: "2026-08-20T09:12:00", playbookId: "P02" },
  { name: "OTA convertibles", recipients: 276, measuredAt: "2026-08-15T14:05:00", playbookId: "P06" }
];

export const mockScanHistory = [
  { scannedAt: "2026-08-31T08:42:00", period: "1 janv. 2026 – 31 août 2026", durationLabel: "6 min 40 s", status: "SUCCESS" as const, healthScore: 89 },
  { scannedAt: "2026-07-31T08:10:00", period: "1 janv. 2026 – 31 juil. 2026", durationLabel: "5 min 58 s", status: "SUCCESS" as const, healthScore: 85 },
  { scannedAt: "2026-06-30T08:05:00", period: "1 janv. 2026 – 30 juin 2026", durationLabel: "7 min 12 s", status: "PARTIAL_SUCCESS" as const, healthScore: 82 }
];
