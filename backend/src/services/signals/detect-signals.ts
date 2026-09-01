/**
 * Moteur de détection de signaux — porté à l'identique depuis
 * docs/reference/moteur-experience-existant.js (bloc 1/8, fonction
 * detectSignals). Règles V1 verrouillées, conformes à l'onglet
 * "Signals & Playbook" du référentiel Excel.
 *
 * Ne pas modifier une condition ici sans l'avoir d'abord mise à jour dans
 * le référentiel (brief §6 : ne jamais deviner une règle métier depuis le
 * code si elle est définie dans le référentiel).
 */

export interface DetectSignalsInput {
  activabilityRate: number;
  captureRate: number;
  nonOtaRate: number;
  returningRate: number;
  returningEvolution: number;
  activationRate: number;
  totalCrmBookings: number;
  automationBookings: number;
}

export interface DetectedSignal {
  /** Identifiant interne de playbook — P01…P12. Jamais affiché à l'utilisateur. */
  playbookId: string;
  /** Valeur(s) ayant déclenché le signal, pour affichage du "pourquoi" (round à 2 décimales). */
  trigger: string;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function detectSignals(input: DetectSignalsInput): { signals: DetectedSignal[]; automationShare: number } {
  const {
    activabilityRate,
    captureRate,
    nonOtaRate,
    returningRate,
    returningEvolution,
    activationRate,
    totalCrmBookings,
    automationBookings
  } = input;

  const signals: DetectedSignal[] = [];

  const automationShare = totalCrmBookings > 0 ? (automationBookings / totalCrmBookings) * 100 : 0;

  // P02 — Collecte critique. Domine P01 + P04.
  const p02 = captureRate < 60 && activabilityRate < 30;
  if (p02) {
    signals.push({
      playbookId: "P02",
      trigger: `Captation ${round2(captureRate)} % < 60 % ET activabilité ${round2(activabilityRate)} % < 30 %`
    });
  }

  // P01 — Captation insuffisante.
  if (!p02 && captureRate < 60) {
    signals.push({ playbookId: "P01", trigger: `Captation ${round2(captureRate)} % < 60 %` });
  }

  // P03 — Déperdition après collecte.
  if (captureRate >= 70 && activabilityRate < 50) {
    signals.push({
      playbookId: "P03",
      trigger: `Captation ${round2(captureRate)} % ≥ 70 % mais activabilité ${round2(activabilityRate)} % < 50 %`
    });
  }

  // P04 — Base activable insuffisante. Masqué par P02.
  if (!p02 && activabilityRate < 30) {
    signals.push({ playbookId: "P04", trigger: `Activabilité ${round2(activabilityRate)} % < 30 %` });
  }

  // P05 — Forte dépendance OTA.
  if (nonOtaRate <= 20) {
    signals.push({ playbookId: "P05", trigger: `Non OTA ${round2(nonOtaRate)} % ≤ 20 %` });
  }

  // P06 — Potentiel OTA → Direct.
  if (nonOtaRate <= 30 && returningRate >= 7) {
    signals.push({
      playbookId: "P06",
      trigger: `Non OTA ${round2(nonOtaRate)} % ≤ 30 % ET Returning Guests ${round2(returningRate)} % ≥ 7 %`
    });
  }

  // P07 — Faible fidélisation.
  if (returningRate < 5) {
    signals.push({ playbookId: "P07", trigger: `Returning Guests ${round2(returningRate)} % < 5 %` });
  }

  // P08 — Fidélisation en recul.
  if (returningEvolution <= -2) {
    signals.push({
      playbookId: "P08",
      trigger: `Évolution Returning Guests ${round2(returningEvolution)} pts ≤ -2 pts`
    });
  }

  // P09 — Potentiel fidélisation inexploité. Returning < 7, strictement.
  if (returningRate < 7 && activabilityRate >= 50 && activationRate >= 18) {
    signals.push({
      playbookId: "P09",
      trigger: `Returning Guests ${round2(returningRate)} % < 7 %, activabilité ${round2(activabilityRate)} % ≥ 50 % et activation ${round2(activationRate)} ‰ ≥ 18`
    });
  }

  // P10 / P11 — P11 domine P10 lorsque la base est suffisamment activable.
  const p11 = activabilityRate >= 50 && activationRate < 8;
  if (p11) {
    signals.push({
      playbookId: "P11",
      trigger: `Activabilité ${round2(activabilityRate)} % ≥ 50 % mais activation CRM ${round2(activationRate)} ‰ < 8`
    });
  } else if (activationRate < 8) {
    signals.push({ playbookId: "P10", trigger: `Activation CRM ${round2(activationRate)} ‰ < 8` });
  }

  // P12 — Concentration automations.
  if (automationShare >= 80 && totalCrmBookings >= 10) {
    signals.push({
      playbookId: "P12",
      trigger: `${round2(automationShare)} % des réservations CRM proviennent des automations, sur ${totalCrmBookings} réservations CRM`
    });
  }

  return { signals, automationShare: round2(automationShare) };
}
