/**
 * Détail mocké de la fiche CRM Health — Hôtel Galileo, tel que représenté
 * dans le mockup fourni.
 *
 * ATTENTION — écart signalé, non résolu (à valider avant la Phase C/E) :
 * plusieurs tuiles ci-dessous (Taux d'opt-in CRM, Clients réactivés,
 * Taux de réactivité pré-stay, Score de satisfaction, Pression marketing,
 * réactivité aux enquêtes) N'ONT PAS de correspondance confirmée dans le
 * catalogue KPI réel (backend/prisma/seed-data/kpi-definitions.ts, issu de
 * l'onglet "Cartographie KPIs"). Le brief §16/§34 interdit explicitement
 * d'assumer qu'une donnée existe parce qu'elle apparaît dans un mockup.
 * Ces tuiles restent donc des données MOCKÉES pour la Phase B uniquement —
 * elles ne doivent pas être branchées telles quelles sur de vraies données
 * en Phase C sans validation explicite de leur source.
 *
 * ÉCART ENTRE LES DEUX MOCKUPS — ARBITRÉ (2026-09-01) :
 * le mockup "Mes portefeuilles" affichait 0 alerte / 1 vigilance /
 * 3 opportunités pour Hôtel Galileo, le mockup "CRM Health — fiche hôtel"
 * affichait 3 alertes / 7 vigilances / 12 opportunités pour ce même hôtel.
 * Tranché : 0 / 1 / 3 partout. Cette fiche ne définit donc plus ses propres
 * compteurs — elle les reçoit de src/mock/data.ts (le hotel passé en prop),
 * seule source de vérité, pour ne plus jamais pouvoir diverger. En Phase C,
 * ces valeurs mockées seront remplacées par les vrais SignalResult issus du
 * moteur de détection (backend/src/services/signals).
 */

export interface KpiTile {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
  status: "En progression" | "Stable" | "À surveiller";
}

export const galileoOverview = {
  period: { start: "1 janv. 2026", end: "31 août 2026", months: 8 },
  lastScanAt: "31 août 2026 à 08:42",
  healthScore: 89,
  healthLevel: "Excellent" as const,
  healthDelta: 11,
  portfolioPosition: { rank: 2, total: 18, delta: 1 },
  kpiAnalyzed: 43,
  strengths: [
    "Excellente progression du CA (+18 %) et des réservations (+15 %)",
    "Bonne conversion OTA → Direct en hausse (+2,1 pts)",
    "Taux de réactivité pré-stay élevé (71 %)",
    "Part de repeaters en progression (+4 pts)"
  ],
  attentionPoints: [
    "Baisse du taux d'opt-in CRM (-3 pts)",
    "Score de satisfaction à surveiller (7,2/10)",
    "Pression marketing élevée vs portefeuille",
    "Faible réactivité aux enquêtes avant séjour",
    "Dépendance OTA encore élevée (58 %)"
  ]
};

export const galileoKpis: KpiTile[] = [
  { label: "CA généré", value: "487 620 €", delta: "↑ 18 %", trend: "up", status: "En progression" },
  { label: "Réservations", value: "1 248", delta: "↑ 15 %", trend: "up", status: "En progression" },
  { label: "Panier moyen", value: "390 €", delta: "↑ 3 %", trend: "up", status: "Stable" },
  { label: "Taux d'opt-in CRM", value: "62 %", delta: "↓ -3 pts", trend: "down", status: "À surveiller" },
  { label: "Conversion OTA → Direct", value: "16,2 %", delta: "↑ 2,1 pts", trend: "up", status: "En progression" },
  { label: "Clients réactivés (12 mois)", value: "132", delta: "↑ 12 %", trend: "up", status: "En progression" },
  { label: "Repeaters", value: "48 %", delta: "↑ 4 pts", trend: "up", status: "En progression" },
  { label: "Taux de réactivité pré-stay", value: "71 %", delta: "↓ -5 pts", trend: "down", status: "À surveiller" }
];

export const galileoBusinessPerformance = {
  compareLabel: "1 janv. – 31 août 2025",
  revenue: { current: 487620, previous: 412800, delta: 18 },
  bookings: { current: 1248, previous: 1084, delta: 15 }
};
