/**
 * Types locaux au mock de la Phase B — volontairement proches, mais pas
 * identiques, aux types @navi/shared définitifs : ils portent des champs
 * de présentation (icônes, libellés déjà formatés) qui n'ont pas vocation
 * à exister tels quels côté backend. À remplacer par de vrais appels API
 * en Phase C, une fois le premier flux réel branché.
 */

export type HealthLevel = "Critique" | "Fragile" | "Correct" | "Bon" | "Excellent";

export interface MockHotel {
  id: string;
  name: string;
  portfolioId: string;
  portfolioName: string;
  lastScanAt: string | null; // null = jamais scanné
  healthScore: number | null;
  healthLevel: HealthLevel | null;
  alerts: number | null;
  vigilances: number | null;
  opportunities: number | null;
  status: "Excellent" | "Sain" | "À surveiller" | "Critique" | "Aucun scan";
}

export interface MockPortfolio {
  id: string;
  name: string;
  hotelCount: number;
  // null = portefeuille tout juste créé, aucun scan encore réalisé à son
  // échelle — pas de score fabriqué (retours Phase C.5, §10).
  healthScore: number | null;
  healthDelta: number;
  scannedCount: number;
  toScanCount: number;
  criticalCount: number;
}
