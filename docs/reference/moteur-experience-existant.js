// ============================================================
// NAVI — MOTEUR INTÉGRÉ
//
// Flow :
// Data
// → CRM Health
// → Signals
// → Opportunities
// → Playbooks
// → Audience Builder
//
// Campaign Studio n'est PAS inclus ici.
// ============================================================
 
const {
  chromium
} = require(
  'playwright'
);
 
const fs =
  require(
    'fs'
  );
 
const path =
  require(
    'path'
  );
 
const readline =
  require(
    'readline'
  );
 
 
// ============================================================
// CONFIGURATION
// ============================================================
 
const USER_DATA_DIR =
  path.join(
    __dirname,
    'experience-profile'
  );
 
 
const CONFIG = {
 
  // ----------------------------------------------------------
  // Pour les premiers tests intégrés :
  // on reste volontairement sur Baudelaire Opéra,
  // qui déclenche P06.
  // ----------------------------------------------------------
 
  hotels: [
    'Hôtel Apollinaire'
  ],
 
 
  // ----------------------------------------------------------
  // PÉRIODE DU SCAN
  //
  // Les KPI date-filterable suivent cette période.
  // OTA et Returning Guests restent basés sur N / N-1.
  // ----------------------------------------------------------
 
  period: {
    mode:
      'preset',
 
    value:
      'last12Months'
  },
 
 
  // ----------------------------------------------------------
  // 3 tentatives maximum par hôtel
  // ----------------------------------------------------------
 
  maxRetries:
    3,
 
 
  // ----------------------------------------------------------
  // SORTIES
  // ----------------------------------------------------------
 
  outputCsv:
    path.join(
      __dirname,
      'navi-integrated-results.csv'
    ),
 
  outputJson:
    path.join(
      __dirname,
      'navi-integrated-results.json'
    )
};
 
 
// ============================================================
// PÉRIODES EXPERIENCE
// ============================================================
 
const PERIOD_PRESETS = {
 
  last12Months:
    '12 derniers mois',
 
  last6Months:
    '6 derniers mois',
 
  last3Months:
    '3 derniers mois'
 
};
 
 
// ============================================================
// MOIS FRANÇAIS
// ============================================================
 
const MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre'
];
 
 
// ============================================================
// UTILITAIRES
// ============================================================
 
function sleep(
  ms
) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}
 
 
function round2(
  value
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      Number(
        value
      )
    )
  ) {
    return null;
  }
 
  return Math.round(
    (
      Number(
        value
      ) +
      Number.EPSILON
    ) *
      100
  ) /
    100;
}
 
 
function round(
  value
) {
  return round2(
    value
  );
}
 
 
function clamp(
  value,
  min,
  max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}
 
 
function normalizeName(
  value
) {
  return String(
    value ||
    ''
  )
    .normalize(
      'NFD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-zA-Z0-9]+/g,
      ''
    )
    .toUpperCase();
}
 
 
function parseFrenchNumber(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }
 
  const normalized =
    String(
      value
    )
      .replace(
        /\u00A0/g,
        ' '
      )
      .replace(
        /\s/g,
        ''
      )
      .replace(
        ',',
        '.'
      )
      .replace(
        /[^0-9.-]/g,
        ''
      );
 
  if (
    !normalized
  ) {
    return null;
  }
 
  const parsed =
    Number(
      normalized
    );
 
  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}
 
 
function formatNumber(
  value
) {
  return new Intl.NumberFormat(
    'fr-FR',
    {
      maximumFractionDigits:
        0
    }
  ).format(
    Number(
      value ||
      0
    )
  );
}
 
 
function formatPercent(
  value
) {
  return new Intl.NumberFormat(
    'fr-FR',
    {
      minimumFractionDigits:
        2,
 
      maximumFractionDigits:
        2
    }
  ).format(
    Number(
      value ||
      0
    )
  );
}
 
 
function formatDuration(
  milliseconds
) {
  const totalSeconds =
    Math.max(
      0,
      Math.round(
        milliseconds /
        1000
      )
    );
 
  const minutes =
    Math.floor(
      totalSeconds /
      60
    );
 
  const seconds =
    totalSeconds %
    60;
 
  if (
    minutes ===
      0
  ) {
    return `${seconds}s`;
  }
 
  return `${minutes}m ${seconds}s`;
}
 
 
function csvEscape(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }
 
  const text =
    String(
      value
    );
 
  if (
    /[",\n]/.test(
      text
    )
  ) {
    return `"${text.replace(
      /"/g,
      '""'
    )}"`;
  }
 
  return text;
}
 
 
// ============================================================
// TERMINAL
// ============================================================
 
function askQuestion(
  question
) {
  return new Promise(
    resolve => {
      const rl =
        readline.createInterface({
          input:
            process.stdin,
 
          output:
            process.stdout
        });
 
      rl.question(
        question,
        answer => {
          rl.close();
 
          resolve(
            answer
          );
        }
      );
    }
  );
}
 
 
async function askYesNo(
  question
) {
  console.log('');
  console.log(
    question
  );
 
  console.log(
    '[1] Oui'
  );
 
  console.log(
    '[2] Non'
  );
 
  while (
    true
  ) {
    const answer =
      (
        await askQuestion(
          '> '
        )
      )
        .trim()
        .toLowerCase();
 
    if (
      [
        '1',
        'oui',
        'o',
        'yes',
        'y'
      ].includes(
        answer
      )
    ) {
      return true;
    }
 
    if (
      [
        '2',
        'non',
        'n',
        'no'
      ].includes(
        answer
      )
    ) {
      return false;
    }
 
    console.log(
      'Merci de choisir 1 ou 2.'
    );
  }
}
 
 
// ============================================================
// DATES
// ============================================================
 
function getDateMonthsAgo(
  months
) {
  const today =
    new Date();
 
  const target =
    new Date(
      today.getFullYear(),
      today.getMonth() -
        months,
      1
    );
 
  const maxDay =
    new Date(
      target.getFullYear(),
      target.getMonth() +
        1,
      0
    ).getDate();
 
  target.setDate(
    Math.min(
      today.getDate(),
      maxDay
    )
  );
 
  return target;
}
 
 
function formatDateFR(
  date
) {
  return [
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    ),
 
    String(
      date.getMonth() +
        1
    ).padStart(
      2,
      '0'
    ),
 
    date.getFullYear()
  ].join(
    '/'
  );
}
 
 
// ============================================================
// NOM DES LISTES TEMPORAIRES NAVI
// ============================================================
 
function createTempName(
  playbookId,
  hotelName = '',
  audienceId = ''
) {
  const now =
    new Date();
 
  const timestamp =
    String(
      now.getFullYear()
    ) +
    String(
      now.getMonth() +
        1
    ).padStart(
      2,
      '0'
    ) +
    String(
      now.getDate()
    ).padStart(
      2,
      '0'
    ) +
    '_' +
    String(
      now.getHours()
    ).padStart(
      2,
      '0'
    ) +
    String(
      now.getMinutes()
    ).padStart(
      2,
      '0'
    ) +
    String(
      now.getSeconds()
    ).padStart(
      2,
      '0'
    );
 
  const parts = [
    'NAVI_TEMP',
    playbookId,
    audienceId,
    normalizeName(
      hotelName
    ),
    timestamp
  ].filter(
    Boolean
  );
 
  return parts.join(
    '_'
  );
}
 
 
// ============================================================
// CRM HEALTH — INTERPOLATION CONTINUE
// ============================================================
 
function interpolateScore(
  value,
  points
) {
  if (
    !Number.isFinite(
      Number(
        value
      )
    )
  ) {
    return 0;
  }
 
  const numeric =
    Number(
      value
    );
 
  if (
    numeric <=
    points[0][0]
  ) {
    return points[0][1];
  }
 
  const last =
    points[
      points.length -
      1
    ];
 
  if (
    numeric >=
    last[0]
  ) {
    return last[1];
  }
 
  for (
    let i = 0;
    i <
    points.length -
      1;
    i++
  ) {
    const [
      x1,
      y1
    ] =
      points[i];
 
    const [
      x2,
      y2
    ] =
      points[
        i +
        1
      ];
 
    if (
      numeric >=
        x1 &&
      numeric <=
        x2
    ) {
      const ratio =
        (
          numeric -
          x1
        ) /
        (
          x2 -
          x1
        );
 
      return y1 +
        ratio *
        (
          y2 -
          y1
        );
    }
  }
 
  return 0;
}
 
 
// ============================================================
// CRM HEALTH — CALCUL
// ============================================================
 
function calculateCRMHealth({
  activabilityRate,
  captureRate,
  nonOtaRate,
  returningRate,
  activationRate
}) {
 
  const baseScore =
    interpolateScore(
      activabilityRate,
      [
        [0, 0],
        [30, 5],
        [50, 10],
        [70, 15],
        [90, 20]
      ]
    );
 
 
  const captureScore =
    interpolateScore(
      captureRate,
      [
        [40, 0],
        [60, 3.75],
        [70, 7.5],
        [80, 11.25],
        [95, 15]
      ]
    );
 
 
  const otaScore =
    interpolateScore(
      nonOtaRate,
      [
        [10, 0],
        [22.5, 5],
        [35, 10],
        [47.5, 15],
        [60, 20]
      ]
    );
 
 
  const loyaltyScore =
    interpolateScore(
      returningRate,
      [
        [0, 0],
        [5, 5],
        [8, 10],
        [12, 15],
        [15, 20]
      ]
    );
 
 
  const activationScore =
    interpolateScore(
      activationRate,
      [
        [0, 0],
        [8, 6.25],
        [18, 12.5],
        [33, 18.75],
        [45, 25]
      ]
    );
 
 
  const totalScore =
    clamp(
      baseScore +
      captureScore +
      otaScore +
      loyaltyScore +
      activationScore,
      0,
      100
    );
 
 
  return {
 
    baseScore:
      round2(
        baseScore
      ),
 
    captureScore:
      round2(
        captureScore
      ),
 
    otaScore:
      round2(
        otaScore
      ),
 
    loyaltyScore:
      round2(
        loyaltyScore
      ),
 
    activationScore:
      round2(
        activationScore
      ),
 
    totalScore:
      round2(
        totalScore
      )
  };
}
 
 
// ============================================================
// CRM HEALTH — LABEL
// ============================================================
 
function getHealthLevel(
  score
) {
  if (
    score <
      40
  ) {
    return 'Critique';
  }
 
  if (
    score <
      60
  ) {
    return 'Fragile';
  }
 
  if (
    score <
      75
  ) {
    return 'Correct';
  }
 
  if (
    score <
      90
  ) {
    return 'Bon';
  }
 
  return 'Excellent';
}
 
 
// ============================================================
// PLAYBOOKS NAVI
//
// DÉCLARATION UNIQUE.
// On ne redéclarera PLUS PLAYBOOKS dans les blocs suivants.
// ============================================================
 
const PLAYBOOKS = {
 
  P01: {
    id:
      'P01',
 
    name:
      'Captation insuffisante',
 
    mode:
      'operational',
 
    audience:
      false
  },
 
 
  P02: {
    id:
      'P02',
 
    name:
      'Collecte CRM critique',
 
    mode:
      'audience',
 
    audience:
      'RISK_INACTIVITY'
  },
 
 
  P03: {
    id:
      'P03',
 
    name:
      'Déperdition après collecte',
 
    mode:
      'audience',
 
    audience:
      'RISK_INACTIVITY'
  },
 
 
  P04: {
    id:
      'P04',
 
    name:
      'Base activable insuffisante',
 
    mode:
      'audience',
 
    audience:
      'RISK_INACTIVITY'
  },
 
 
  P05: {
    id:
      'P05',
 
    name:
      'Forte dépendance OTA',
 
    mode:
      'low_perf',
 
    audience:
      false
  },
 
 
  P06: {
    id:
      'P06',
 
    name:
      'Potentiel OTA → Direct',
 
    mode:
      'audience',
 
    audience:
      'OTA_CONVERTIBLE'
  },
 
 
  P07: {
    id:
      'P07',
 
    name:
      'Faible fidélisation',
 
    mode:
      'audience',
 
    audience:
      'SECOND_BOOKING'
  },
 
 
  P08: {
    id:
      'P08',
 
    name:
      'Fidélisation en recul',
 
    mode:
      'contextual',
 
    audience:
      false
  },
 
 
  P09: {
    id:
      'P09',
 
    name:
      'Potentiel fidélisation inexploité',
 
    mode:
      'audience',
 
    audience:
      'HIGH_VALUE_ONE_TIMER'
  },
 
 
  P10: {
    id:
      'P10',
 
    name:
      'Sous-activation CRM',
 
    mode:
      'p10',
 
    audience:
      'dynamic'
  },
 
 
  P11: {
    id:
      'P11',
 
    name:
      'Base CRM sous-exploitée',
 
    mode:
      'opportunity_finder',
 
    audience:
      'multiple'
  },
 
 
  P12: {
    id:
      'P12',
 
    name:
      'Business CRM concentré sur les automations',
 
    mode:
      'contextual',
 
    audience:
      false
  }
 
};
 
 
// ============================================================
// CRÉATION STANDARD D'UN SIGNAL
// ============================================================
 
function createSignal(
  id,
  trigger
) {
  const playbook =
    PLAYBOOKS[
      id
    ];
 
  return {
    id,
 
    playbook:
      id,
 
    name:
      playbook
        ? playbook.name
        : id,
 
    trigger,
 
    reason:
      trigger
  };
}
 
 
// ============================================================
// SIGNAL ENGINE
//
// RÈGLES V1 VERROUILLÉES.
// ============================================================
 
function detectSignals({
  activabilityRate,
  captureRate,
  nonOtaRate,
  returningRate,
  returningEvolution,
  activationRate,
  totalCrmBookings,
  automationBookings
}) {
 
  let signals =
    [];
 
 
  const automationShare =
    totalCrmBookings >
      0
      ? (
          automationBookings /
          totalCrmBookings
        ) *
        100
      : 0;
 
 
  // ----------------------------------------------------------
  // P02 — Collecte critique
  //
  // Domine P01 + P04.
  // ----------------------------------------------------------
 
  const p02 =
    captureRate <
      60 &&
    activabilityRate <
      30;
 
  if (
    p02
  ) {
    signals.push(
      createSignal(
        'P02',
        `Captation ${round2(
          captureRate
        )} % < 60 % ET activabilité ${round2(
          activabilityRate
        )} % < 30 %`
      )
    );
  }
 
 
  // ----------------------------------------------------------
  // P01 — Captation insuffisante
  // ----------------------------------------------------------
 
  if (
    !p02 &&
    captureRate <
      60
  ) {
    signals.push(
      createSignal(
        'P01',
        `Captation ${round2(
          captureRate
        )} % < 60 %`
      )
    );
  }
 
 
  // ----------------------------------------------------------
  // P03 — Déperdition après collecte
  // ----------------------------------------------------------
 
  if (
    captureRate >=
      70 &&
    activabilityRate <
      50
  ) {
    signals.push(
      createSignal(
        'P03',
        `Captation ${round2(
          captureRate
        )} % ≥ 70 % mais activabilité ${round2(
          activabilityRate
        )} % < 50 %`
      )
    );
  }
 
 
  // ----------------------------------------------------------
  // P04 — Base activable insuffisante
  //
  // Masqué par P02.
  // ----------------------------------------------------------
 
  if (
    !p02 &&
    activabilityRate <
      30
  ) {
    signals.push(
      createSignal(
        'P04',
        `Activabilité ${round2(
          activabilityRate
        )} % < 30 %`
      )
    );
  }
 
 
  // ----------------------------------------------------------
  // P05 — Forte dépendance OTA
  // ----------------------------------------------------------
 
  if (
    nonOtaRate <=
      20
  ) {
    signals.push(
      createSignal(
        'P05',
        `Non OTA ${round2(
          nonOtaRate
        )} % ≤ 20 %`
      )
    );
  }
 
 
  // ----------------------------------------------------------
  // P06 — Potentiel OTA → Direct
  // ----------------------------------------------------------
 
  if (
    nonOtaRate <=
      30 &&
    returningRate >=
      7
  ) {
    signals.push(
      createSignal(
        'P06',
        `Non OTA ${round2(
          nonOtaRate
        )} % ≤ 30 % ET Returning Guests ${round2(
          returningRate
        )} % ≥ 7 %`
      )
    );
  }
 
 
  // ----------------------------------------------------------
  // P07 — Faible fidélisation
  // ----------------------------------------------------------
 
  if (
    returningRate <
      5
  ) {
    signals.push(
      createSignal(
        'P07',
        `Returning Guests ${round2(
          returningRate
        )} % < 5 %`
      )
    );
  }
 
 
  // ----------------------------------------------------------
  // P08 — Fidélisation en recul
  // ----------------------------------------------------------
 
  if (
    returningEvolution <=
      -2
  ) {
    signals.push(
      createSignal(
        'P08',
        `Évolution Returning Guests ${round2(
          returningEvolution
        )} pts ≤ -2 pts`
      )
    );
  }
 
 
  // ----------------------------------------------------------
  // P09 — Potentiel fidélisation inexploité
  //
  // IMPORTANT : Returning < 7, strictement.
  // ----------------------------------------------------------
 
  if (
    returningRate <
      7 &&
    activabilityRate >=
      50 &&
    activationRate >=
      18
  ) {
    signals.push(
      createSignal(
        'P09',
        `Returning Guests ${round2(
          returningRate
        )} % < 7 %, activabilité ${round2(
          activabilityRate
        )} % ≥ 50 % et activation ${round2(
          activationRate
        )} ‰ ≥ 18`
      )
    );
  }
 
 
  // ----------------------------------------------------------
  // P10 / P11
  //
  // P11 domine P10 lorsque la base est suffisamment activable.
  // ----------------------------------------------------------
 
  const p11 =
    activabilityRate >=
      50 &&
    activationRate <
      8;
 
  if (
    p11
  ) {
    signals.push(
      createSignal(
        'P11',
        `Activabilité ${round2(
          activabilityRate
        )} % ≥ 50 % mais activation CRM ${round2(
          activationRate
        )} ‰ < 8`
      )
    );
 
  } else if (
    activationRate <
      8
  ) {
    signals.push(
      createSignal(
        'P10',
        `Activation CRM ${round2(
          activationRate
        )} ‰ < 8`
      )
    );
  }
 
 
  // ----------------------------------------------------------
  // P12 — Concentration automations
  // ----------------------------------------------------------
 
  if (
    automationShare >=
      80 &&
    totalCrmBookings >=
      10
  ) {
    signals.push(
      createSignal(
        'P12',
        `${round2(
          automationShare
        )} % des réservations CRM proviennent des automations, sur ${formatNumber(
          totalCrmBookings
        )} réservations CRM`
      )
    );
  }
 
 
  return {
    signals,
 
    automationShare:
      round2(
        automationShare
      )
  };
}
 
 
// ============================================================
// AUDIENCE DEFINITIONS
//
// Une seule source de vérité pour P02/P03/P04/P06/P07/P09.
// ============================================================
 
const AUDIENCE_DEFINITIONS = {
 
  RISK_INACTIVITY: {
    id:
      'RISK_INACTIVITY',
 
    name:
      'Profils à risque d’inactivité',
 
    playbooks: [
      'P02',
      'P03',
      'P04'
    ],
 
    filters: [
      {
        field:
          'emailNotOpenedSince',
 
        relativeMonths:
          12
      },
 
      {
        field:
          'lastStayDate',
 
        operator:
          '>=',
 
        relativeMonths:
          36
      }
    ]
  },
 
 
  OTA_CONVERTIBLE: {
    id:
      'OTA_CONVERTIBLE',
 
    name:
      'OTA convertibles',
 
    playbooks: [
      'P06'
    ],
 
    filters: [
      {
        field:
          'stayCount',
 
        operator:
          '>=',
 
        value:
          2
      },
 
      {
        field:
          'lastStayChannel',
 
        value: [
          'EXPEDIA',
          'EXPEDIA AGENCIA PDJ OFFERT',
          'EXPEDIA PAY TO HOTEL',
          'Expedia Virtual Card',
          'BOOKING.COM',
          'BOOKING.COM COLLECT',
          'BOOKING.COM ONLINE PAYMENT'
        ]
      },
 
      {
        field:
          'lastStayDate',
 
        operator:
          '>=',
 
        relativeMonths:
          36
      }
    ]
  },
 
 
  SECOND_BOOKING: {
    id:
      'SECOND_BOOKING',
 
    name:
      'Deuxième réservation',
 
    playbooks: [
      'P07'
    ],
 
    filters: [
      {
        field:
          'stayCount',
 
        operator:
          '=',
 
        value:
          1
      },
 
      {
        field:
          'lastStayDate',
 
        operator:
          'between',
 
        relativeMonthsFrom:
          18,
 
        relativeMonthsTo:
          3
      }
    ]
  },
 
 
  HIGH_VALUE_ONE_TIMER: {
    id:
      'HIGH_VALUE_ONE_TIMER',
 
    name:
      'One-timers à forte valeur',
 
    playbooks: [
      'P09'
    ],
 
    filters: [
      {
        field:
          'stayCount',
 
        operator:
          '=',
 
        value:
          1
      },
 
      {
        field:
          'lastStayDate',
 
        operator:
          '>=',
 
        relativeMonths:
          12
      },
 
      {
        field:
          'stayAmount',
 
        operator:
          '>=',
 
        dynamicValue:
          'averageSpend'
      }
    ]
  }
 
};
 
 
// ============================================================
// P11 — OPPORTUNITY FINDER
// ============================================================
 
const P11_OPPORTUNITIES = [
 
  {
    id:
      'ONETIMER',
 
    name:
      'One-timers à réactiver',
 
    description:
      'Clients venus une seule fois et non revenus depuis 12 à 36 mois.',
 
    potentialScore:
      15,
 
    actionabilityScore:
      15,
 
    filters: [
      {
        field:
          'stayCount',
 
        operator:
          '=',
 
        value:
          1
      },
 
      {
        field:
          'lastStayDate',
 
        operator:
          'between',
 
        relativeMonthsFrom:
          36,
 
        relativeMonthsTo:
          12
      }
    ]
  },
 
 
  {
    id:
      'REPEATER',
 
    name:
      'Repeaters dormants',
 
    description:
      'Clients ayant déjà séjourné au moins deux fois mais absents depuis 18 à 36 mois.',
 
    potentialScore:
      30,
 
    actionabilityScore:
      20,
 
    filters: [
      {
        field:
          'stayCount',
 
        operator:
          '>=',
 
        value:
          2
      },
 
      {
        field:
          'lastStayDate',
 
        operator:
          'between',
 
        relativeMonthsFrom:
          36,
 
        relativeMonthsTo:
          18
      }
    ]
  },
 
 
  {
    id:
      'OTA',
 
    name:
      'OTA convertibles',
 
    description:
      'Repeaters dont le dernier séjour provient de Booking ou Expedia.',
 
    potentialScore:
      25,
 
    actionabilityScore:
      20,
 
    filters: [
      {
        field:
          'stayCount',
 
        operator:
          '>=',
 
        value:
          2
      },
 
      {
        field:
          'lastStayChannel',
 
        value: [
          'EXPEDIA',
          'EXPEDIA AGENCIA PDJ OFFERT',
          'EXPEDIA PAY TO HOTEL',
          'Expedia Virtual Card',
          'BOOKING.COM',
          'BOOKING.COM COLLECT',
          'BOOKING.COM ONLINE PAYMENT'
        ]
      },
 
      {
        field:
          'lastStayDate',
 
        operator:
          '>=',
 
        relativeMonths:
          36
      }
    ]
  }
 
];
 
 
// ============================================================
// P11 — SCORE RELATIF
// ============================================================
 
function getVolumeScore(
  recipients
) {
  if (
    recipients <
      100
  ) {
    return 0;
  }
 
  if (
    recipients <
      250
  ) {
    return 10;
  }
 
  if (
    recipients <
      500
  ) {
    return 20;
  }
 
  if (
    recipients <
      1000
  ) {
    return 30;
  }
 
  if (
    recipients <
      2000
  ) {
    return 40;
  }
 
  return 50;
}
 
 
// ============================================================
// P11 — NIVEAU
// ============================================================
 
function getOpportunityLevel(
  score
) {
  if (
    score <
      40
  ) {
    return 'Opportunité marginale';
  }
 
  if (
    score <
      60
  ) {
    return 'Opportunité secondaire';
  }
 
  if (
    score <
      75
  ) {
    return 'Opportunité intéressante';
  }
 
  if (
    score <
      90
  ) {
    return 'Opportunité forte';
  }
 
  return 'Opportunité prioritaire';
}
 
 
// ============================================================
// P11 — SCORE TOTAL
// ============================================================
 
function calculateOpportunityScore(
  opportunity,
  recipients
) {
  const volumeScore =
    getVolumeScore(
      recipients
    );
 
  const totalScore =
    volumeScore +
    opportunity.potentialScore +
    opportunity.actionabilityScore;
 
  return {
 
    volumeScore,
 
    potentialScore:
      opportunity.potentialScore,
 
    actionabilityScore:
      opportunity.actionabilityScore,
 
    totalScore,
 
    level:
      getOpportunityLevel(
        totalScore
      )
  };
}
// ============================================================
// NAVI — BLOC 2/8
// AUTHENTIFICATION + NAVIGATION EXPERIENCE
// ============================================================
 
 
// ============================================================
// SESSION EXPERIENCE
//
// RÈGLE :
// - on ouvre directement la racine Experience
// - si l'interface authentifiée est déjà visible : on continue
// - sinon seulement : connexion manuelle / 2FA
//
// Le profil persistant experience-profile conserve la session.
// ============================================================
 
async function connectToExperience(
  page
) {
  console.log('');
  console.log(
    '🔐 Vérification de la session Experience...'
  );
 
  await page.goto(
    'https://crm.experience-hotel.com/',
    {
      waitUntil:
        'domcontentloaded',
 
      timeout:
        60000
    }
  );
 
  await sleep(
    1500
  );
 
 
  // ----------------------------------------------------------
  // ÉLÉMENTS QUI PROUVENT QU'ON EST DÉJÀ CONNECTÉ
  // ----------------------------------------------------------
 
  const hotelSearch =
    page.getByRole(
      'searchbox',
      {
        name:
          /Rechercher/i
      }
    );
 
 
  const xpLink =
    page.getByRole(
      'link',
      {
        name:
          'XP',
 
        exact:
          true
      }
    );
 
 
  const changeSpace =
    page.getByRole(
      'button',
      {
        name:
          /Changer d'espace/i
      }
    );
 
 
  const authenticated =
    (
      await hotelSearch
        .first()
        .isVisible()
        .catch(
          () =>
            false
        )
    ) ||
    (
      await xpLink
        .first()
        .isVisible()
        .catch(
          () =>
            false
        )
    ) ||
    (
      await changeSpace
        .first()
        .isVisible()
        .catch(
          () =>
            false
        )
    );
 
 
  if (
    authenticated
  ) {
    console.log(
      '✅ Session Experience déjà active — aucune reconnexion'
    );
 
    return;
  }
 
 
  // ----------------------------------------------------------
  // PAS DE SESSION ACTIVE
  // ----------------------------------------------------------
 
  console.log(
    '⚠️ Session Experience non détectée.'
  );
 
  console.log(
    '→ Connexion manuelle nécessaire.'
  );
 
 
  const loginButton =
    page.getByRole(
      'button',
      {
        name:
          /Connexion/i
      }
    );
 
 
  if (
    await loginButton
      .isVisible()
      .catch(
        () =>
          false
      )
  ) {
    await loginButton.click();
 
    await sleep(
      800
    );
  }
 
 
  console.log('');
  console.log(
    '👉 Connecte-toi dans la fenêtre Experience.'
  );
 
  console.log(
    '👉 Si Experience demande le code 2FA, renseigne-le normalement.'
  );
 
  console.log(
    '👉 NAVI reprendra automatiquement dès que la session sera active.'
  );
 
 
  // ----------------------------------------------------------
  // ATTENTE DE L'INTERFACE AUTHENTIFIÉE
  // ----------------------------------------------------------
 
  await Promise.race([
 
    hotelSearch
      .first()
      .waitFor({
        state:
          'visible',
 
        timeout:
          180000
      }),
 
    xpLink
      .first()
      .waitFor({
        state:
          'visible',
 
        timeout:
          180000
      }),
 
    changeSpace
      .first()
      .waitFor({
        state:
          'visible',
 
        timeout:
          180000
      })
 
  ]);
 
 
  console.log(
    '✅ Connexion Experience détectée.'
  );
}
 
 
// ============================================================
// RETOUR / ACCÈS À LA LISTE DES HÔTELS
// ============================================================
 
async function goToHotelList(
  page
) {
  console.log('');
  console.log(
    '🏨 Accès à la liste des hôtels...'
  );
 
 
  // ----------------------------------------------------------
  // Si la recherche hôtel est déjà visible, rien à faire.
// ----------------------------------------------------------
 
  const existingSearch =
    page.getByRole(
      'searchbox',
      {
        name:
          /Rechercher/i
      }
    );
 
 
  if (
    await existingSearch
      .first()
      .isVisible()
      .catch(
        () =>
          false
      )
  ) {
    console.log(
      '✅ Liste des hôtels déjà accessible.'
    );
 
    return;
  }
 
 
  // ----------------------------------------------------------
  // Sinon on tente le lien XP
  // ----------------------------------------------------------
 
  const xpLink =
    page.getByRole(
      'link',
      {
        name:
          'XP',
 
        exact:
          true
      }
    );
 
 
  if (
    await xpLink
      .first()
      .isVisible()
      .catch(
        () =>
          false
      )
  ) {
    await xpLink
      .first()
      .click();
 
    await sleep(
      800
    );
  }
 
 
  // ----------------------------------------------------------
  // Attente recherche hôtel
  // ----------------------------------------------------------
 
  const search =
    page.getByRole(
      'searchbox',
      {
        name:
          /Rechercher/i
      }
    );
 
 
  await search
    .first()
    .waitFor({
      state:
        'visible',
 
      timeout:
        30000
    });
 
 
  console.log(
    '✅ Liste des hôtels accessible.'
  );
}
 
 
// ============================================================
// SÉLECTION D'UN HÔTEL
// ============================================================
 
async function selectHotel(
  page,
  hotelName
) {
  console.log('');
  console.log(
    `🏨 Sélection hôtel : ${hotelName}`
  );
 
 
  await goToHotelList(
    page
  );
 
 
  const search =
    page
      .getByRole(
        'searchbox',
        {
          name:
            /Rechercher/i
        }
      )
      .first();
 
 
  await search.fill(
    ''
  );
 
  await sleep(
    200
  );
 
 
  await search.fill(
    hotelName
  );
 
 
  // ----------------------------------------------------------
  // IMPORTANT :
  // certaines interfaces Experience ne réagissent pas
  // immédiatement au fill().
  // ----------------------------------------------------------
 
  await search.press(
    'Space'
  );
 
  await search.press(
    'Backspace'
  );
 
 
  await sleep(
    700
  );
 
 
  // ----------------------------------------------------------
  // Recherche exacte d'abord
  // ----------------------------------------------------------
 
  let hotelLink =
    page.getByRole(
      'link',
      {
        name:
          hotelName,
 
        exact:
          true
      }
    );
 
 
  if (
    !await hotelLink
      .first()
      .isVisible()
      .catch(
        () =>
          false
      )
  ) {
    // --------------------------------------------------------
    // Fallback texte
    // --------------------------------------------------------
 
    hotelLink =
      page.getByText(
        hotelName,
        {
          exact:
            true
        }
      );
  }
 
 
  await hotelLink
    .first()
    .waitFor({
      state:
        'visible',
 
      timeout:
        30000
    });
 
 
  await hotelLink
    .first()
    .click();
 
 
  await sleep(
    1200
  );
 
 
  console.log(
    `✅ Hôtel sélectionné : ${hotelName}`
  );
}
 
 
// ============================================================
// OUVERTURE REPORTING
//
// Séquence validée :
// Changer d'espace → Reporting
// ============================================================
 
async function openReporting(
  page
) {
  const reportingLinks =
    page.getByRole(
      'link',
      {
        name:
          /Activité|Analyse base client|Revenu/i
      }
    );
 
 
  if (
    await reportingLinks
      .first()
      .isVisible()
      .catch(
        () =>
          false
      )
  ) {
    return;
  }
 
 
  const changeSpace =
    page.getByRole(
      'button',
      {
        name:
          /Changer d'espace/i
      }
    );
 
 
  await changeSpace.waitFor({
    state:
      'visible',
 
    timeout:
      30000
  });
 
 
  await changeSpace.click();
 
 
  const reporting =
    page.getByRole(
      'button',
      {
        name:
          /Reporting/i
      }
    );
 
 
  await reporting.waitFor({
    state:
      'visible',
 
    timeout:
      30000
  });
 
 
  await reporting.click();
 
 
  await sleep(
    700
  );
}
 
 
// ============================================================
// PÉRIODE — VERSION VALIDÉE
//
// IMPORTANT :
// cette fonction remplace définitivement la version générique
// de notre première tentative.
//
// Experience :
// toggle → preset → Valider
// ============================================================
 
async function applyPeriodWithToggle(
  page,
  period
) {
  if (
    !period ||
    period.mode !==
      'preset'
  ) {
    throw new Error(
      'Pour cette V1, NAVI attend une période preset Experience.'
    );
  }
 
 
  const label =
    PERIOD_PRESETS[
      period.value
    ];
 
 
  if (
    !label
  ) {
    throw new Error(
      `Preset de période inconnu : ${period.value}`
    );
  }
 
 
  console.log(
    `📅 Période : ${label}`
  );
 
 
  const toggle =
    page
      .locator(
        '.bigicon.toggle > .button'
      )
      .first();
 
 
  await toggle.waitFor({
    state:
      'visible',
 
    timeout:
      15000
  });
 
 
  await toggle.click();
 
 
  const preset =
    page.getByRole(
      'button',
      {
        name:
          label,
 
        exact:
          false
      }
    );
 
 
  await preset.waitFor({
    state:
      'visible',
 
    timeout:
      10000
  });
 
 
  await preset.click();
 
 
  const validate =
    page.getByRole(
      'button',
      {
        name:
          'Valider'
      }
    );
 
 
  await validate.waitFor({
    state:
      'visible',
 
    timeout:
      10000
  });
 
 
  await validate.click();
 
 
  await sleep(
    1800
  );
 
 
  console.log(
    `✅ Période appliquée : ${label}`
  );
}
 
 
// ============================================================
// ANALYSE BASE CLIENT
// ============================================================
 
async function openCustomerAnalysis(
  page
) {
  console.log('');
  console.log(
    '📊 Ouverture Analyse base client...'
  );
 
 
  await openReporting(
    page
  );
 
 
  const link =
    page.getByRole(
      'link',
      {
        name:
          /Analyse base client/i
      }
    );
 
 
  await link.waitFor({
    state:
      'visible',
 
    timeout:
      30000
  });
 
 
  await link.click();
 
 
  await sleep(
    1800
  );
 
 
  console.log(
    '✅ Analyse base client ouverte.'
  );
}
 
 
// ============================================================
// ACTIVITÉ
// ============================================================
 
async function openActivity(
  page
) {
  console.log('');
  console.log(
    '📊 Ouverture Activité...'
  );
 
 
  await openReporting(
    page
  );
 
 
  const link =
    page.getByRole(
      'link',
      {
        name:
          /Activité/i
      }
    );
 
 
  await link.waitFor({
    state:
      'visible',
 
    timeout:
      30000
  });
 
 
  await link.click();
 
 
  await sleep(
    1800
  );
 
 
  console.log(
    '✅ Activité ouverte.'
  );
}
 
 
// ============================================================
// REVENU
//
// IMPORTANT :
// Returning Guests sera lu APRÈS openRevenue().
// ============================================================
 
async function openRevenue(
  page
) {
  console.log('');
  console.log(
    '📊 Ouverture Revenu...'
  );
 
 
  await openReporting(
    page
  );
 
 
  const link =
    page.getByRole(
      'link',
      {
        name:
          /Revenu/i
      }
    );
 
 
  await link.waitFor({
    state:
      'visible',
 
    timeout:
      30000
  });
 
 
  await link.click();
 
 
  await sleep(
    1800
  );
 
 
  console.log(
    '✅ Revenu ouvert.'
  );
}
 
 
// ============================================================
// FIN BLOC 2/8
// ============================================================
// ============================================================
// NAVI — BLOC 3/8
// SCRAPERS CRM HEALTH
// ============================================================
 
 
// ============================================================
// PARSING
// ============================================================
 
function parseNumber(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }
 
  const normalized =
    String(
      value
    )
      .replace(
        /\u00A0/g,
        ' '
      )
      .replace(
        /\s/g,
        ''
      );
 
  const match =
    normalized.match(
      /-?\d+(?:[.,]\d+)?/
    );
 
  if (
    !match
  ) {
    return null;
  }
 
  const parsed =
    Number(
      match[0]
        .replace(
          ',',
          '.'
        )
    );
 
  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}
 
 
function parsePercentage(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }
 
  const normalized =
    String(
      value
    )
      .replace(
        /\u00A0/g,
        ' '
      );
 
  const match =
    normalized.match(
      /(-?\d+(?:[.,]\d+)?)\s*%/
    );
 
  if (
    !match
  ) {
    return null;
  }
 
  return Number(
    match[1]
      .replace(
        ',',
        '.'
      )
  );
}
 
 
function evolutionPoints(
  current,
  previous
) {
  if (
    !Number.isFinite(
      Number(
        current
      )
    ) ||
    !Number.isFinite(
      Number(
        previous
      )
    )
  ) {
    return null;
  }
 
  return round2(
    Number(
      current
    ) -
    Number(
      previous
    )
  );
}
 
 
// ============================================================
// BASE EXPLOITABLE
// ============================================================
 
async function readBaseSummary(
  page
) {
  const summary =
    page
      .getByText(
        /renseignés sur un total/i
      )
      .first();
 
 
  await summary.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  const text =
    await summary.innerText();
 
 
  const normalized =
    text.replace(
      /\u00A0/g,
      ' '
    );
 
 
  const match =
    normalized.match(
      /([\d\s]+)\s+renseignés\s+sur\s+un\s+total\s+de\s+([\d\s]+)\s+profils?\s+clients?/i
    );
 
 
  if (
    !match
  ) {
    throw new Error(
      `Résumé base illisible : ${text}`
    );
  }
 
 
  return {
 
    emailsProvided:
      Number(
        match[1]
          .replace(
            /\s/g,
            ''
          )
      ),
 
    totalProfiles:
      Number(
        match[2]
          .replace(
            /\s/g,
            ''
          )
      )
  };
}
 
 
async function readTableRow(
  page,
  labelText
) {
  const label =
    page
      .getByRole(
        'cell',
        {
          name:
            labelText,
 
          exact:
            false
        }
      )
      .first();
 
 
  await label.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  const row =
    label.locator(
      'xpath=ancestor::tr[1]'
    );
 
 
  return await row.innerText();
}
 
 
async function scrapeGeneralKPIs(
  page
) {
  const {
    emailsProvided,
    totalProfiles
  } =
    await readBaseSummary(
      page
    );
 
 
  const emailRow =
    await readTableRow(
      page,
      'Profils avec e-mail renseigné'
    );
 
 
  const otaRow =
    await readTableRow(
      page,
      'Profils avec e-mails Agences'
    );
 
 
  const unsubRow =
    await readTableRow(
      page,
      'Désinscrits'
    );
 
 
  const usableRow =
    await readTableRow(
      page,
      'Profils avec e-mail utilisable'
    );
 
 
  const usableEmails =
    parseNumber(
      usableRow.replace(
        /Profils avec e-mail utilisable/i,
        ''
      )
    );
 
 
  const activabilityRate =
    totalProfiles >
      0
      ? (
          usableEmails /
          totalProfiles
        ) *
        100
      : null;
 
 
  return {
 
    totalProfiles,
 
    emailsProvided,
 
    emailCoverageRate:
      parsePercentage(
        emailRow
      ),
 
    otaAgencyRate:
      parsePercentage(
        otaRow
      ),
 
    unsubscribedRate:
      parsePercentage(
        unsubRow
      ),
 
    usableEmails,
 
    activabilityRate:
      round2(
        activabilityRate
      )
  };
}
 
 
// ============================================================
// CAPTATION E-MAIL
// ============================================================
 
async function scrapeEmailCapture(
  page
) {
  const label =
    page
      .getByRole(
        'paragraph'
      )
      .filter({
        hasText:
          "Captation d'e-mail"
      })
      .first();
 
 
  await label.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  const cardText =
    await label.evaluate(
      element => {
        let current =
          element;
 
        for (
          let i = 0;
          i < 10;
          i++
        ) {
          if (
            !current
          ) {
            break;
          }
 
          const text =
            current.innerText ||
            '';
 
          if (
            /Captation d['’]e-mail/i
              .test(
                text
              ) &&
            /\d+(?:[.,]\d+)?\s*%/
              .test(
                text
              ) &&
            /\d[\d\s]*\s*\/\s*\d[\d\s]*/
              .test(
                text
              )
          ) {
            return text;
          }
 
          current =
            current.parentElement;
        }
 
        return '';
      }
    );
 
 
  const normalized =
    cardText
      .replace(
        /\u00A0/g,
        ' '
      )
      .replace(
        /\n+/g,
        ' '
      );
 
 
  const percent =
    normalized.match(
      /(\d+(?:[.,]\d+)?)\s*%/
    );
 
 
  const ratio =
    normalized.match(
      /(\d[\d\s]*)\s*\/\s*(\d[\d\s]*)/
    );
 
 
  if (
    !percent ||
    !ratio
  ) {
    throw new Error(
      'Captation e-mail illisible'
    );
  }
 
 
  const displayedRate =
    Number(
      percent[1]
        .replace(
          ',',
          '.'
        )
    );
 
 
  const capturedEmails =
    Number(
      ratio[1]
        .replace(
          /\s/g,
          ''
        )
    );
 
 
  const captureBase =
    Number(
      ratio[2]
        .replace(
          /\s/g,
          ''
        )
    );
 
 
  const calculatedRate =
    captureBase >
      0
      ? (
          capturedEmails /
          captureBase
        ) *
        100
      : null;
 
 
  return {
 
    displayedRate,
 
    capturedEmails,
 
    captureBase,
 
    calculatedRate:
      round2(
        calculatedRate
      )
  };
}
 
 
// ============================================================
// HIGHCHARTS — LECTURE N / N-1
// ============================================================
 
async function readHighchartShares(
  page,
  chartTitle,
  yearN,
  yearN1
) {
  const title =
    page
      .getByRole(
        'strong'
      )
      .filter({
        hasText:
          chartTitle
      })
      .first();
 
 
  await title.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  const chart =
    title.locator(
      'xpath=ancestor::*[.//*[contains(@class,"highcharts-container")]][1]'
    );
 
 
  const svg =
    chart
      .locator(
        'svg.highcharts-root'
      )
      .first();
 
 
  await svg.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  const elements =
    await svg
      .locator(
        'text'
      )
      .evaluateAll(
        nodes =>
          nodes.map(
            el => {
              const box =
                el.getBoundingClientRect();
 
              return {
 
                text:
                  (
                    el.textContent ||
                    ''
                  ).trim(),
 
                x:
                  box.left +
                  box.width /
                    2,
 
                y:
                  box.top +
                  box.height /
                    2
              };
            }
          )
      );
 
 
  function yearPosition(
    year
  ) {
    return elements
      .filter(
        item =>
          item.text ===
          String(
            year
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          b.y -
          a.y
      )[0];
  }
 
 
  const yearNElement =
    yearPosition(
      yearN
    );
 
 
  const yearN1Element =
    yearPosition(
      yearN1
    );
 
 
  if (
    !yearNElement ||
    !yearN1Element
  ) {
    throw new Error(
      `Années introuvables : ${chartTitle}`
    );
  }
 
 
  const percentages =
    elements
      .map(
        item => {
          const match =
            item.text.match(
              /(\d+(?:[.,]\d+)?)\s*%/
            );
 
          if (
            !match
          ) {
            return null;
          }
 
          return {
 
            value:
              Number(
                match[1]
                  .replace(
                    ',',
                    '.'
                  )
              ),
 
            x:
              item.x
          };
        }
      )
      .filter(
        Boolean
      );
 
 
  function closest(
    yearElement
  ) {
    return [
      ...percentages
    ].sort(
      (
        a,
        b
      ) =>
        Math.abs(
          a.x -
          yearElement.x
        ) -
        Math.abs(
          b.x -
          yearElement.x
        )
    )[0];
  }
 
 
  const current =
    closest(
      yearNElement
    );
 
 
  const previous =
    closest(
      yearN1Element
    );
 
 
  if (
    !current ||
    !previous
  ) {
    throw new Error(
      `Pourcentages introuvables : ${chartTitle}`
    );
  }
 
 
  return {
 
    N:
      current.value,
 
    N1:
      previous.value
  };
}
 
 
// ============================================================
// OTA — UN CANAL
// ============================================================
 
async function scrapeRevenueChannel(
  page,
  config,
  yearN,
  yearN1
) {
  const tab =
    page.getByRole(
      'button',
      {
        name:
          config.tabName,
 
        exact:
          true
      }
    );
 
 
  await tab.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  await tab.click();
 
 
  await sleep(
    1200
  );
 
 
  const reservationShare =
    await readHighchartShares(
      page,
      config.reservationTitle,
      yearN,
      yearN1
    );
 
 
  const revenueShare =
    await readHighchartShares(
      page,
      config.revenueTitle,
      yearN,
      yearN1
    );
 
 
  return {
 
    reservationShare,
 
    revenueShare,
 
    reservationEvolution:
      evolutionPoints(
        reservationShare.N,
        reservationShare.N1
      ),
 
    revenueEvolution:
      evolutionPoints(
        revenueShare.N,
        revenueShare.N1
      )
  };
}
 
 
// ============================================================
// OTA — BOOKING + EXPEDIA + NON OTA
// ============================================================
 
async function scrapeRevenueOTAKPIs(
  page
) {
  const yearN =
    new Date()
      .getFullYear();
 
 
  const yearN1 =
    yearN -
    1;
 
 
  const booking =
    await scrapeRevenueChannel(
      page,
      {
        tabName:
          'Booking.com',
 
        reservationTitle:
          'Part des réservations Booking',
 
        revenueTitle:
          'Part du CA Booking.com / CA'
      },
      yearN,
      yearN1
    );
 
 
  const expedia =
    await scrapeRevenueChannel(
      page,
      {
        tabName:
          'Expedia',
 
        reservationTitle:
          'Part des réservations Expedia',
 
        revenueTitle:
          'Part du CA Expedia / CA Total'
      },
      yearN,
      yearN1
    );
 
 
  const nonOta =
    await scrapeRevenueChannel(
      page,
      {
        tabName:
          'Non OTA',
 
        reservationTitle:
          'Part des réservations Non OTA',
 
        revenueTitle:
          'Part du CA Non OTA / CA Total'
      },
      yearN,
      yearN1
    );
 
 
  return {
 
    yearN,
 
    yearN1,
 
    booking,
 
    expedia,
 
    nonOta
  };
}
 
 
// ============================================================
// RETURNING GUESTS
//
// IMPORTANT :
// appeler cette fonction APRÈS openRevenue(page).
// ============================================================
 
async function scrapeReturningGuests(
  page
) {
  const yearN =
    new Date()
      .getFullYear();
 
 
  const yearN1 =
    yearN -
    1;
 
 
  const tab =
    page.getByRole(
      'link',
      {
        name:
          /Returning guests/i
      }
    );
 
 
  await tab.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  await tab.click();
 
 
  await sleep(
    1200
  );
 
 
  const title =
    page
      .getByText(
        /Le pourcentage de Returning/i
      )
      .first();
 
 
  await title.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  const svg =
    page
      .locator(
        'svg.highcharts-root'
      )
      .first();
 
 
  await svg.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  const elements =
    await svg
      .locator(
        'text'
      )
      .evaluateAll(
        nodes =>
          nodes.map(
            el => {
              const box =
                el.getBoundingClientRect();
 
              return {
 
                text:
                  (
                    el.textContent ||
                    ''
                  ).trim(),
 
                x:
                  box.left +
                  box.width /
                    2,
 
                y:
                  box.top +
                  box.height /
                    2
              };
            }
          )
      );
 
 
  function getYear(
    year
  ) {
    return elements
      .filter(
        item =>
          item.text ===
          String(
            year
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          b.y -
          a.y
      )[0];
  }
 
 
  const posN =
    getYear(
      yearN
    );
 
 
  const posN1 =
    getYear(
      yearN1
    );
 
 
  if (
    !posN ||
    !posN1
  ) {
    throw new Error(
      'Années Returning Guests introuvables'
    );
  }
 
 
  const percentages =
    elements
      .map(
        item => {
          const match =
            item.text.match(
              /(\d+(?:[.,]\d+)?)\s*%/
            );
 
          if (
            !match
          ) {
            return null;
          }
 
          return {
 
            value:
              Number(
                match[1]
                  .replace(
                    ',',
                    '.'
                  )
              ),
 
            x:
              item.x
          };
        }
      )
      .filter(
        Boolean
      );
 
 
  function closest(
    pos
  ) {
    return [
      ...percentages
    ].sort(
      (
        a,
        b
      ) =>
        Math.abs(
          a.x -
          pos.x
        ) -
        Math.abs(
          b.x -
          pos.x
        )
    )[0];
  }
 
 
  const current =
    closest(
      posN
    );
 
 
  const previous =
    closest(
      posN1
    );
 
 
  if (
    !current ||
    !previous
  ) {
    throw new Error(
      'Valeurs Returning Guests introuvables'
    );
  }
 
 
  const N =
    current.value;
 
 
  const N1 =
    previous.value;
 
 
  return {
 
    yearN,
 
    yearN1,
 
    N,
 
    N1,
 
    evolution:
      evolutionPoints(
        N,
        N1
      )
  };
}
 
 
// ============================================================
// STATISTIQUES MARKETING — OUVERTURE
// ============================================================
 
async function openMarketingStats(
  page
) {
  console.log('');
  console.log(
    '📊 Ouverture Statistiques Marketing...'
  );
 
 
  await openReporting(
    page
  );
 
 
  const link =
    page.getByRole(
      'link',
      {
        name:
          /Statistiques Marketing/i
      }
    );
 
 
  await link.waitFor({
    state:
      'visible',
 
    timeout:
      30000
  });
 
 
  await link.click();
 
 
  await sleep(
    1500
  );
 
 
  console.log(
    '✅ Statistiques Marketing ouvertes.'
  );
}
 
 
// ============================================================
// STATISTIQUES MARKETING — PÉRIODE
// ============================================================
 
async function setMarketingPeriod(
  page,
  period
) {
  const label =
    PERIOD_PRESETS[
      period.value
    ];
 
 
  if (
    !label
  ) {
    throw new Error(
      `Preset marketing inconnu : ${period.value}`
    );
  }
 
 
  const periodControl =
    page
      .getByText(
        'Période',
        {
          exact:
            true
        }
      )
      .first();
 
 
  await periodControl.waitFor({
    state:
      'visible',
 
    timeout:
      15000
  });
 
 
  await periodControl.click();
 
 
  const presetButton =
    page.getByRole(
      'button',
      {
        name:
          label,
 
        exact:
          false
      }
    );
 
 
  await presetButton.waitFor({
    state:
      'visible',
 
    timeout:
      10000
  });
 
 
  await presetButton.click();
 
 
  await page
    .getByRole(
      'button',
      {
        name:
          'Valider'
      }
    )
    .click();
 
 
  await sleep(
    1800
  );
 
 
  console.log(
    `✅ Période Marketing : ${label}`
  );
}
 
 
// ============================================================
// STATISTIQUES MARKETING — LECTURE CARTE
// ============================================================
 
async function readMarketingMetric(
  labelLocator,
  type
) {
  await labelLocator.waitFor({
    state:
      'visible',
 
    timeout:
      15000
  });
 
 
  const cardText =
    await labelLocator.evaluate(
      (
        element,
        metricType
      ) => {
        let current =
          element;
 
        for (
          let i = 0;
          i < 8;
          i++
        ) {
          if (
            !current
          ) {
            break;
          }
 
          const text =
            (
              current.innerText ||
              ''
            )
              .replace(
                /\u00A0/g,
                ' '
              )
              .trim();
 
 
          if (
            metricType ===
              'currency' &&
            /Chiffre d'affaires/i
              .test(
                text
              ) &&
            /\d[\d\s]*[,.]\d{2}\s*€/
              .test(
                text
              )
          ) {
            return text;
          }
 
 
          if (
            metricType ===
              'number' &&
            /Nombre de réservations/i
              .test(
                text
              )
          ) {
            const withoutLabel =
              text.replace(
                /Nombre de réservations/i,
                ''
              );
 
            if (
              /\d/.test(
                withoutLabel
              )
            ) {
              return text;
            }
          }
 
 
          current =
            current.parentElement;
        }
 
        return '';
      },
      type
    );
 
 
  if (
    !cardText
  ) {
    throw new Error(
      `Carte KPI marketing introuvable (${type})`
    );
  }
 
 
  const normalized =
    cardText
      .replace(
        /\u00A0/g,
        ' '
      )
      .replace(
        /\n+/g,
        ' '
      )
      .trim();
 
 
  if (
    type ===
      'currency'
  ) {
    const currencyMatch =
      normalized.match(
        /(\d[\d\s]*[,.]\d{2})\s*€/
      );
 
 
    if (
      !currencyMatch
    ) {
      throw new Error(
        `CA introuvable : ${normalized}`
      );
    }
 
 
    return Number(
      currencyMatch[1]
        .replace(
          /\s/g,
          ''
        )
        .replace(
          ',',
          '.'
        )
    );
  }
 
 
  const withoutLabel =
    normalized.replace(
      /Nombre de réservations/i,
      ''
    );
 
 
  const numberMatch =
    withoutLabel.match(
      /\d[\d\s]*/
    );
 
 
  if (
    !numberMatch
  ) {
    throw new Error(
      `Réservations introuvables : ${normalized}`
    );
  }
 
 
  return Number(
    numberMatch[0]
      .replace(
        /\s/g,
        ''
      )
  );
}
 
 
// ============================================================
// STATISTIQUES MARKETING — KPI
// ============================================================
 
async function scrapeMarketingKPIs(
  page
) {
  const revenueLabels =
    page.getByText(
      "Chiffre d'affaires",
      {
        exact:
          true
      }
    );
 
 
  const bookingLabels =
    page.getByText(
      'Nombre de réservations',
      {
        exact:
          true
      }
    );
 
 
  const revenueCount =
    await revenueLabels.count();
 
 
  const bookingCount =
    await bookingLabels.count();
 
 
  if (
    revenueCount <
      3
  ) {
    throw new Error(
      `Pas assez de cartes CA : ${revenueCount}`
    );
  }
 
 
  if (
    bookingCount <
      4
  ) {
    throw new Error(
      `Pas assez de cartes réservations : ${bookingCount}`
    );
  }
 
 
  const totalRevenue =
    await readMarketingMetric(
      revenueLabels.nth(
        0
      ),
      'currency'
    );
 
 
  const totalBookings =
    await readMarketingMetric(
      bookingLabels.nth(
        0
      ),
      'number'
    );
 
 
  const campaignRevenue =
    await readMarketingMetric(
      revenueLabels.nth(
        1
      ),
      'currency'
    );
 
 
  const campaignBookings =
    await readMarketingMetric(
      bookingLabels.nth(
        2
      ),
      'number'
    );
 
 
  const automationRevenue =
    await readMarketingMetric(
      revenueLabels.nth(
        2
      ),
      'currency'
    );
 
 
  const automationBookings =
    await readMarketingMetric(
      bookingLabels.nth(
        3
      ),
      'number'
    );
 
 
  return {
 
    total: {
 
      revenue:
        totalRevenue,
 
      bookings:
        totalBookings
    },
 
 
    campaigns: {
 
      revenue:
        campaignRevenue,
 
      bookings:
        campaignBookings
    },
 
 
    automations: {
 
      revenue:
        automationRevenue,
 
      bookings:
        automationBookings
    }
  };
}
 
 
// ============================================================
// CALCUL ACTIVATION CRM
//
// Nombre de réservations CRM
// -------------------------- × 1000
// profils avec e-mail utilisable
// ============================================================
 
function calculateActivationRate(
  totalCrmBookings,
  usableEmails
) {
  if (
    !Number.isFinite(
      Number(
        totalCrmBookings
      )
    ) ||
    !Number.isFinite(
      Number(
        usableEmails
      )
    ) ||
    Number(
      usableEmails
    ) <=
      0
  ) {
    return null;
  }
 
 
  return round2(
    (
      Number(
        totalCrmBookings
      ) /
      Number(
        usableEmails
      )
    ) *
      1000
  );
}
 
 
// ============================================================
// FIN BLOC 3/8
// ============================================================
// ============================================================
// NAVI — BLOC 4/8
// AUDIENCE BUILDER — BRIQUES DE SEGMENTATION
// ============================================================
 
 
// ============================================================
// LISTES D'ENVOI
// ============================================================
 
async function openMailingLists(
  page
) {
  console.log('');
  console.log(
    '📂 Ouverture Listes d’envoi...'
  );
 
 
  const existingLink =
    page.getByRole(
      'link',
      {
        name:
          /Listes d'envoi/i
      }
    );
 
 
  if (
    await existingLink
      .first()
      .isVisible()
      .catch(
        () =>
          false
      )
  ) {
    await existingLink
      .first()
      .click();
 
 
    await sleep(
      1200
    );
 
 
    console.log(
      '✅ Listes d’envoi ouvertes.'
    );
 
 
    return;
  }
 
 
  const changeSpace =
    page.getByRole(
      'button',
      {
        name:
          /Changer d'espace/i
      }
    );
 
 
  await changeSpace.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  await changeSpace.click();
 
 
  await sleep(
    400
  );
 
 
  const campaigns =
    page.getByRole(
      'button',
      {
        name:
          /Campagnes/i
      }
    );
 
 
  await campaigns.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  await campaigns.click();
 
 
  await sleep(
    500
  );
 
 
  const lists =
    page.getByRole(
      'link',
      {
        name:
          /Listes d'envoi/i
      }
    );
 
 
  await lists.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  await lists.click();
 
 
  await sleep(
    1000
  );
 
 
  console.log(
    '✅ Listes d’envoi ouvertes.'
  );
}
 
 
// ============================================================
// NOUVELLE LISTE
// ============================================================
 
async function startNewAudience(
  page
) {
  console.log('');
  console.log(
    '🆕 Nouvelle audience NAVI...'
  );
 
 
  const newList =
    page.getByRole(
      'link',
      {
        name:
          /Nouvelle liste/
      }
    );
 
 
  await newList.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  await newList.click();
 
 
  await sleep(
    500
  );
 
 
  const fromBase =
    page.getByRole(
      'link',
      {
        name:
          /A partir de ma base clients/i
      }
    );
 
 
  await fromBase.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  await fromBase.click();
 
 
  await sleep(
    800
  );
 
 
  console.log(
    '✅ Segmentation base clients ouverte.'
  );
}
 
 
// ============================================================
// AJOUT D'UNE CONDITION AND
//
// IMPORTANT :
// Première condition = 4e zone "Ajouter une condition"
// dans l'interface Experience validée.
// ============================================================
 
async function addAndCondition(
  page,
  isFirstCondition
) {
  if (
    isFirstCondition
  ) {
    const zones =
      page
        .locator(
          'div'
        )
        .filter({
          hasText:
            /^Ajouter une condition$/
        });
 
 
    const count =
      await zones.count();
 
 
    console.log(
      `      [DEBUG] ${count} zone(s) "Ajouter une condition" trouvée(s)`
    );
 
 
    if (
      count <
        4
    ) {
      throw new Error(
        `Seulement ${count} zone(s) "Ajouter une condition" trouvée(s).`
      );
    }
 
 
    await zones
      .nth(
        3
      )
      .click();
 
  } else {
    const addCondition =
      page
        .getByRole(
          'heading',
          {
            name:
              'Ajouter une condition'
          }
        )
        .first();
 
 
    await addCondition.waitFor({
      state:
        'visible',
 
      timeout:
        20000
    });
 
 
    await addCondition.click();
  }
 
 
  await sleep(
    350
  );
}
 
 
// ============================================================
// NOMBRE DE SÉJOURS
// ============================================================
 
async function addStayCountFilter(
  page,
  operator,
  value,
  isFirstCondition
) {
  console.log(
    `   → Nombre de réservations total ${operator} ${value}`
  );
 
 
  await addAndCondition(
    page,
    isFirstCondition
  );
 
 
  const search =
    page.getByRole(
      'textbox',
      {
        name:
          'Rechercher'
      }
    );
 
 
  await search.fill(
    'nombre'
  );
 
 
  await sleep(
    300
  );
 
 
  await page
    .getByRole(
      'link',
      {
        name:
          'Nombre de réservations total'
      }
    )
    .click();
 
 
  await sleep(
    250
  );
 
 
  let experienceOperator;
 
 
  if (
    operator ===
      '='
  ) {
    experienceOperator =
      'Equal';
 
  } else if (
    operator ===
      '>='
  ) {
    experienceOperator =
      'GreaterThanOrEqual';
 
  } else {
    throw new Error(
      `Opérateur Nombre de séjours non supporté : ${operator}`
    );
  }
 
 
  await page
    .locator(
      '#app'
    )
    .getByRole(
      'combobox'
    )
    .selectOption(
      experienceOperator
    );
 
 
  await page
    .getByRole(
      'spinbutton'
    )
    .fill(
      String(
        value
      )
    );
 
 
  await page
    .getByRole(
      'button',
      {
        name:
          'Valider'
      }
    )
    .click();
 
 
  await sleep(
    450
  );
 
 
  console.log(
    '      ✅ Filtre nombre de séjours validé'
  );
}
 
 
// ============================================================
// CALENDRIER — CLIQUER UN TEXTE EXACT VISIBLE
// ============================================================
 
async function clickVisibleExactText(
  page,
  text,
  debugName = text
) {
  const locator =
    page.getByText(
      String(
        text
      ),
      {
        exact:
          true
      }
    );
 
 
  const count =
    await locator.count();
 
 
  const candidates =
    [];
 
 
  for (
    let i = 0;
    i < count;
    i++
  ) {
    const current =
      locator.nth(
        i
      );
 
 
    if (
      await current
        .isVisible()
        .catch(
          () =>
            false
        )
    ) {
      const box =
        await current
          .boundingBox()
          .catch(
            () =>
              null
          );
 
 
      if (
        box
      ) {
        candidates.push({
          locator:
            current,
 
          box
        });
      }
    }
  }
 
 
  if (
    candidates.length ===
      0
  ) {
    throw new Error(
      `${debugName} introuvable.`
    );
  }
 
 
  // ----------------------------------------------------------
  // On privilégie la plus petite zone cliquable.
  // C'est la stratégie qui avait résolu le problème
  // de superposition dans le datepicker Experience.
  // ----------------------------------------------------------
 
  candidates.sort(
    (
      a,
      b
    ) =>
      (
        a.box.width *
        a.box.height
      ) -
      (
        b.box.width *
        b.box.height
      )
  );
 
 
  for (
    const candidate
    of candidates
  ) {
    try {
      await candidate
        .locator
        .click({
          timeout:
            2000
        });
 
 
      return;
 
    } catch (_) {}
  }
 
 
  throw new Error(
    `${debugName} non cliquable.`
  );
}
 
 
// ============================================================
// CALENDRIER — ANNÉE PRÉCÉDENTE
// ============================================================
 
async function clickPreviousYear(
  page
) {
  const arrows =
    page.getByText(
      '<',
      {
        exact:
          true
      }
    );
 
 
  const count =
    await arrows.count();
 
 
  console.log(
    `      [DEBUG] ${count} flèche(s) "<" trouvée(s)`
  );
 
 
  if (
    count >
      1
  ) {
    const preferredArrow =
      arrows.nth(
        1
      );
 
 
    if (
      await preferredArrow
        .isVisible()
        .catch(
          () =>
            false
        )
    ) {
      await preferredArrow.click();
 
 
      await sleep(
        250
      );
 
 
      return;
    }
  }
 
 
  for (
    let i = 0;
    i < count;
    i++
  ) {
    const arrow =
      arrows.nth(
        i
      );
 
 
    if (
      await arrow
        .isVisible()
        .catch(
          () =>
            false
        )
    ) {
      await arrow.click();
 
 
      await sleep(
        250
      );
 
 
      return;
    }
  }
 
 
  throw new Error(
    'Flèche année précédente introuvable.'
  );
}
 
 
// ============================================================
// CALENDRIER — SÉLECTION D'UNE DATE
// ============================================================
 
async function selectDateWithCalendar(
  page,
  input,
  targetDate
) {
  const targetDay =
    String(
      targetDate.getDate()
    );
 
 
  const targetMonth =
    MONTHS_FR[
      targetDate.getMonth()
    ];
 
 
  const targetYear =
    targetDate.getFullYear();
 
 
  const now =
    new Date();
 
 
  const currentMonth =
    MONTHS_FR[
      now.getMonth()
    ];
 
 
  const currentYear =
    now.getFullYear();
 
 
  console.log(
    `      📅 Sélection : ${formatDateFR(
      targetDate
    )}`
  );
 
 
  await input.click();
 
 
  await sleep(
    400
  );
 
 
  const expectedHeader =
    `${currentMonth} ${currentYear}`;
 
 
  const exactHeader =
    page.getByText(
      expectedHeader,
      {
        exact:
          true
      }
    );
 
 
  if (
    await exactHeader
      .isVisible()
      .catch(
        () =>
          false
      )
  ) {
    await exactHeader.click();
 
  } else {
    const monthYearHeader =
      page
        .locator(
          'body *'
        )
        .filter({
          hasText:
            /^(Janvier|Février|Mars|Avril|Mai|Juin|Juillet|Août|Septembre|Octobre|Novembre|Décembre)\s+\d{4}$/
        });
 
 
    const headerCount =
      await monthYearHeader.count();
 
 
    let clicked =
      false;
 
 
    for (
      let i = 0;
      i < headerCount;
      i++
    ) {
      const candidate =
        monthYearHeader.nth(
          i
        );
 
 
      if (
        await candidate
          .isVisible()
          .catch(
            () =>
              false
          )
      ) {
        await candidate.click();
 
 
        clicked =
          true;
 
 
        break;
      }
    }
 
 
    if (
      !clicked
    ) {
      throw new Error(
        'Header "Mois Année" du calendrier introuvable.'
      );
    }
  }
 
 
  await sleep(
    400
  );
 
 
  const yearsBack =
    currentYear -
    targetYear;
 
 
  console.log(
    `      → année cible ${targetYear} (${yearsBack} recul)`
  );
 
 
  for (
    let i = 0;
    i < yearsBack;
    i++
  ) {
    await clickPreviousYear(
      page
    );
 
 
    console.log(
      `         ✓ recul année ${i + 1}/${yearsBack}`
    );
  }
 
 
  console.log(
    `      → mois ${targetMonth}`
  );
 
 
  await clickVisibleExactText(
    page,
    targetMonth,
    `Mois ${targetMonth}`
  );
 
 
  await sleep(
    350
  );
 
 
  console.log(
    `      → jour ${targetDay}`
  );
 
 
  await clickVisibleExactText(
    page,
    targetDay,
    `Jour ${targetDay}`
  );
 
 
  await sleep(
    450
  );
 
 
  const value =
    await input
      .inputValue()
      .catch(
        () =>
          ''
      );
 
 
  console.log(
    `      [DEBUG] champ = "${value}"`
  );
 
 
  if (
    !value
  ) {
    throw new Error(
      `La date ${formatDateFR(
        targetDate
      )} n'a pas été enregistrée.`
    );
  }
 
 
  console.log(
    `      ✅ Date sélectionnée : ${value}`
  );
}
 
 
// ============================================================
// DERNIER SÉJOUR ≤ X MOIS
//
// Techniquement dans Experience :
// Date de départ >= date située X mois dans le passé.
// ============================================================
 
async function addLastStayAfterFilter(
  page,
  months,
  isFirstCondition
) {
  const targetDate =
    getDateMonthsAgo(
      months
    );
 
 
  console.log(
    `   → Date de départ >= ${formatDateFR(
      targetDate
    )}`
  );
 
 
  await addAndCondition(
    page,
    isFirstCondition
  );
 
 
  await page
    .getByRole(
      'link',
      {
        name:
          'Date de départ',
 
        exact:
          true
      }
    )
    .click();
 
 
  await sleep(
    250
  );
 
 
  await page
    .locator(
      '#app'
    )
    .getByRole(
      'combobox'
    )
    .selectOption(
      'GreaterThanOrEqual'
    );
 
 
  await sleep(
    250
  );
 
 
  const input =
    page
      .getByRole(
        'textbox'
      )
      .nth(
        4
      );
 
 
  await selectDateWithCalendar(
    page,
    input,
    targetDate
  );
 
 
  await page
    .getByRole(
      'button',
      {
        name:
          'Valider'
      }
    )
    .click();
 
 
  await sleep(
    450
  );
 
 
  console.log(
    '      ✅ Filtre date validé'
  );
}
 
 
// ============================================================
// DERNIER SÉJOUR ENTRE X ET Y MOIS
// ============================================================
 
async function addLastStayBetweenFilter(
  page,
  monthsFrom,
  monthsTo,
  isFirstCondition
) {
  const dateFrom =
    getDateMonthsAgo(
      monthsFrom
    );
 
 
  const dateTo =
    getDateMonthsAgo(
      monthsTo
    );
 
 
  console.log(
    `   → Date de départ comprise entre ${formatDateFR(
      dateFrom
    )} et ${formatDateFR(
      dateTo
    )}`
  );
 
 
  await addAndCondition(
    page,
    isFirstCondition
  );
 
 
  await page
    .getByRole(
      'link',
      {
        name:
          'Date de départ',
 
        exact:
          true
      }
    )
    .click();
 
 
  await sleep(
    250
  );
 
 
  await page
    .locator(
      '#app'
    )
    .getByRole(
      'combobox'
    )
    .selectOption(
      'Between'
    );
 
 
  await sleep(
    250
  );
 
 
  const textboxes =
    page.getByRole(
      'textbox'
    );
 
 
  console.log(
    `      [DEBUG] ${await textboxes.count()} textbox(s) trouvé(s)`
  );
 
 
  const input1 =
    textboxes.nth(
      4
    );
 
 
  const input2 =
    textboxes.nth(
      5
    );
 
 
  console.log('');
  console.log(
    '      📅 DATE 1 — début de période'
  );
 
 
  await selectDateWithCalendar(
    page,
    input1,
    dateFrom
  );
 
 
  console.log('');
  console.log(
    '      📅 DATE 2 — fin de période'
  );
 
 
  await selectDateWithCalendar(
    page,
    input2,
    dateTo
  );
 
 
  const value1 =
    await input1
      .inputValue()
      .catch(
        () =>
          ''
      );
 
 
  const value2 =
    await input2
      .inputValue()
      .catch(
        () =>
          ''
      );
 
 
  console.log('');
  console.log(
    `      [DEBUG] DATE 1 = "${value1}"`
  );
 
 
  console.log(
    `      [DEBUG] DATE 2 = "${value2}"`
  );
 
 
  const validateButton =
    page.getByRole(
      'button',
      {
        name:
          'Valider'
      }
    );
 
 
  await validateButton.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  await validateButton.click();
 
 
  await sleep(
    500
  );
 
 
  console.log(
    '      ✅ Between validé'
  );
}
 
 
// ============================================================
// Canal de la dernière réservation
// ============================================================
 
async function addLastStayChannelFilter(
  page,
  channels,
  isFirstCondition
) {
  console.log(
    '   → Canal de la dernière réservation = Booking / Expedia'
  );
 
 
  await addAndCondition(
    page,
    isFirstCondition
  );
 
 
  const search =
    page.getByRole(
      'textbox',
      {
        name:
          'Rechercher'
      }
    );
 
 
  await search.fill(
    'cana'
  );
 
 
  await sleep(
    300
  );
 
 
  await page
    .getByRole(
      'link',
      {
        name:
          'Canal de la dernière réservation'
      }
    )
    .click();
 
 
  await sleep(
    400
  );
 
 
  // ----------------------------------------------------------
  // IMPORTANT : les libellés Booking / Expedia varient
  // d'un hôtel à l'autre. NAVI ne dépend donc PAS d'une
  // liste fixe. Il lit les options réellement disponibles
  // dans Experience et sélectionne toutes celles contenant
  // BOOKING ou EXPEDIA.
  // ----------------------------------------------------------
 
  const searchboxes =
    page.getByRole(
      'searchbox'
    );
 
 
  let channelSearch =
    null;
 
 
  const searchboxCount =
    await searchboxes.count();
 
 
  for (
    let i =
      searchboxCount - 1;
    i >= 0;
    i--
  ) {
    const candidate =
      searchboxes.nth(
        i
      );
 
 
    if (
      await candidate
        .isVisible()
        .catch(
          () =>
            false
        )
    ) {
      channelSearch =
        candidate;
 
      break;
    }
  }
 
 
  if (
    !channelSearch
  ) {
    throw new Error(
      'Champ de recherche des canaux introuvable.'
    );
  }
 
 
  const normalizeChannel =
    value =>
      String(
        value ||
        ''
      )
        .replace(
          /\u00A0/g,
          ' '
        )
        .replace(
          /\s+/g,
          ' '
        )
        .trim()
        .toUpperCase();
 
 
  const discovered =
    new Map();
 
 
  for (
    const searchValue
    of [
      'book',
      'expe'
    ]
  ) {
    await channelSearch.fill(
      searchValue
    );
 
 
    await sleep(
      350
    );
 
 
    const options =
      page.getByRole(
        'option'
      );
 
 
    const optionCount =
      await options.count();
 
 
    for (
      let i = 0;
      i < optionCount;
      i++
    ) {
      const option =
        options.nth(
          i
        );
 
 
      if (
        !await option
          .isVisible()
          .catch(
            () =>
              false
          )
      ) {
        continue;
      }
 
 
      const rawLabel =
        await option
          .innerText()
          .catch(
            () =>
              ''
          );
 
 
      const normalized =
        normalizeChannel(
          rawLabel
        );
 
 
      if (
        normalized.includes(
          'BOOKING'
        ) ||
        normalized.includes(
          'EXPEDIA'
        )
      ) {
        discovered.set(
          normalized,
          rawLabel.trim()
        );
      }
    }
  }
 
 
  const otaChannels =
    [
      ...discovered.values()
    ];
 
 
  if (
    otaChannels.length ===
      0
  ) {
    throw new Error(
      'Aucun canal Booking / Expedia détecté dans Experience pour cet hôtel.'
    );
  }
 
 
  console.log(
    `      ${otaChannels.length} canal(aux) OTA détecté(s) dans Experience`
  );
 
 
  for (
    const channel
    of otaChannels
  ) {
    const searchValue =
      normalizeChannel(
        channel
      ).includes(
        'EXPEDIA'
      )
        ? 'expe'
        : 'book';
 
 
    await channelSearch.fill(
      searchValue
    );
 
 
    await sleep(
      250
    );
 
 
    const options =
      page.getByRole(
        'option'
      );
 
 
    const optionCount =
      await options.count();
 
 
    let clicked =
      false;
 
 
    for (
      let i = 0;
      i < optionCount;
      i++
    ) {
      const option =
        options.nth(
          i
        );
 
 
      if (
        !await option
          .isVisible()
          .catch(
            () =>
              false
          )
      ) {
        continue;
      }
 
 
      const optionLabel =
        await option
          .innerText()
          .catch(
            () =>
              ''
          );
 
 
      if (
        normalizeChannel(
          optionLabel
        ) ===
        normalizeChannel(
          channel
        )
      ) {
        await option.click();
 
 
        console.log(
          `      ✓ ${channel}`
        );
 
 
        clicked =
          true;
 
 
        break;
      }
    }
 
 
    if (
      !clicked
    ) {
      throw new Error(
        `Canal OTA détecté mais impossible à sélectionner : ${channel}`
      );
    }
  }
 
 
  await page
    .getByRole(
      'button',
      {
        name:
          'Valider'
      }
    )
    .click();
 
 
  await sleep(
    500
  );
 
 
  console.log(
    '      ✅ Tous les canaux Booking / Expedia disponibles ont été sélectionnés'
  );
}
 
 
// ============================================================
// CONSTRUCTION GÉNÉRIQUE D'UNE AUDIENCE
//
// Pour l'instant :
// - Nombre de séjours
// - Canal de la dernière réservation
// - Dernier séjour <= X mois
// - Dernier séjour entre X et Y mois
//
// P02/P03/P04 et P09 ajoutent leurs filtres spécifiques
// dans le bloc 5.
// ============================================================
 
async function buildAudienceDefinition(
  page,
  definition,
  dynamicValues = {}
) {
  if (
    !definition
  ) {
    throw new Error(
      'Définition audience NAVI absente.'
    );
  }
 
 
  console.log('');
  console.log(
    '=============================================='
  );
 
 
  console.log(
    `🧩 ${definition.id} — ${definition.name}`
  );
 
 
  console.log(
    '=============================================='
  );
 
 
  let firstCondition =
    true;
 
 
  for (
    const filter
    of definition.filters
  ) {
 
    if (
      filter.field ===
        'stayCount'
    ) {
      await addStayCountFilter(
        page,
        filter.operator,
        filter.value,
        firstCondition
      );
    }
 
 
    else if (
      filter.field ===
        'lastStayChannel'
    ) {
      await addLastStayChannelFilter(
        page,
        filter.value,
        firstCondition
      );
    }
 
 
    else if (
      filter.field ===
        'lastStayDate' &&
      filter.operator ===
        '>='
    ) {
      await addLastStayAfterFilter(
        page,
        filter.relativeMonths,
        firstCondition
      );
    }
 
 
    else if (
      filter.field ===
        'lastStayDate' &&
      filter.operator ===
        'between'
    ) {
      await addLastStayBetweenFilter(
        page,
        filter.relativeMonthsFrom,
        filter.relativeMonthsTo,
        firstCondition
      );
    }
 
 
    else if (
      filter.field ===
        'emailNotOpenedSince'
    ) {
      await addEmailNotOpenedSinceFilter(
        page,
        filter.relativeMonths,
        firstCondition
      );
    }
 
 
    else if (
      filter.field ===
        'stayAmount'
    ) {
      const value =
        filter.dynamicValue
          ? dynamicValues[
              filter.dynamicValue
            ]
          : filter.value;
 
 
      await addStayAmountFilter(
        page,
        filter.operator,
        value,
        firstCondition
      );
    }
 
 
    else {
      throw new Error(
        `Filtre Audience Builder non pris en charge : ${JSON.stringify(
          filter
        )}`
      );
    }
 
 
    firstCondition =
      false;
  }
}
 
 
// ============================================================
// RECALCUL DES RÉSULTATS
// ============================================================
 
async function recalculateResults(
  page
) {
  console.log('');
  console.log(
    '🔢 Recalcul des résultats Experience...'
  );
 
 
  const button =
    page.getByRole(
      'button',
      {
        name:
          /Recalculer les résultats/i
      }
    );
 
 
  await button.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  await button.click();
 
 
  const exclusion =
    page
      .getByText(
        /Exclure les clients ayant une réservation future ou présents dans l'établissement/i
      )
      .first();
 
 
  await exclusion.waitFor({
    state:
      'visible',
 
    timeout:
      30000
  });
 
 
  await sleep(
    1000
  );
 
 
  console.log(
    '      ✅ Résultats Experience affichés'
  );
}
 
 
// ============================================================
// MODE DESTINATAIRES NAVI
//
// SOURCE DE VÉRITÉ :
// Exclure les clients ayant une réservation future
// ou présents dans l'établissement.
// ============================================================
 
async function selectNaviMode(
  page
) {
  console.log('');
  console.log(
    '☑️ Sélection du mode NAVI...'
  );
 
 
  const exclusion =
    page
      .getByText(
        /Exclure les clients ayant une réservation future ou présents dans l'établissement/i
      )
      .first();
 
 
  await exclusion.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  await exclusion.click();
 
 
  await sleep(
    400
  );
 
 
  console.log(
    '      ✅ Exclusion réservations futures / clients présents sélectionnée'
  );
}
 
 
// ============================================================
// FIN BLOC 4/8
// ============================================================
// ============================================================
// NAVI — BLOC 5/8
// AUDIENCE BUILDER — FILTRES SPÉCIFIQUES + PREVIEW
// ============================================================
 
 
// ============================================================
// P02 / P03 / P04
// AUCUN E-MAIL OUVERT DEPUIS >= X MOIS
//
// NAVI cherche le champ d'ouverture e-mail disponible
// dans Experience puis applique une date <= X mois.
// ============================================================
 
async function addEmailNotOpenedSinceFilter(
  page,
  months,
  isFirstCondition
) {
  // ========================================================
  // MÉCANIQUE P02 / P03 / P04 VALIDÉE PAR CODEGEN
  // Source de vérité : test-p02-p03-p04-audience.js
  //
  // Experience expose ici le champ de valeur comme le
  // 5e textbox de l'écran de segmentation (nth(4)).
  // On conserve volontairement cette mécanique exacte :
  // pas de recherche d'opérateur, pas de détection générique.
  // ========================================================
 
  const filter = {
    value: months
  };
 
  console.log(
    `   → N'a pas ouvert d'e-mail depuis ${filter.value} mois`
  );
 
  await addAndCondition(
    page,
    isFirstCondition
  );
 
  const search = page.getByRole(
    'textbox',
    {
      name: 'Rechercher'
    }
  );
 
  await search.waitFor({
    state: 'visible',
    timeout: 20000
  });
 
  await search.fill("n'a");
 
  await sleep(300);
 
  const filterLink = page.getByRole(
    'link',
    {
      name: "N'a pas ouvert d'e-mail"
    }
  );
 
  await filterLink.waitFor({
    state: 'visible',
    timeout: 20000
  });
 
  await filterLink.click();
 
  await sleep(300);
 
  const textboxes = page.getByRole(
    'textbox'
  );
 
  const count = await textboxes.count();
 
  console.log(
    `      [DEBUG] ${count} textbox(s) trouvé(s)`
  );
 
  if (
    count < 5
  ) {
    throw new Error(
      `Champ nombre de mois introuvable : seulement ${count} textbox(s).`
    );
  }
 
  const monthsInput = textboxes.nth(4);
 
  await monthsInput.click();
 
  await monthsInput.fill(
    String(filter.value)
  );
 
  const value = await monthsInput
    .inputValue()
    .catch(
      () => ''
    );
 
  console.log(
    `      [DEBUG] champ mois = "${value}"`
  );
 
  if (
    value !== String(filter.value)
  ) {
    throw new Error(
      `Valeur du filtre e-mail incorrecte : "${value}".`
    );
  }
 
  const validate = page.getByRole(
    'button',
    {
      name: 'Valider'
    }
  );
 
  await validate.waitFor({
    state: 'visible',
    timeout: 20000
  });
 
  await validate.click();
 
  await sleep(500);
 
  console.log(
    '      ✅ Filtre inactivité e-mail validé'
  );
}
 
 
// ============================================================
// P09 — Montant de la réservation
//
// Montant >= dépense moyenne par réservation.
// ============================================================
 
async function addStayAmountFilter(
  page,
  operator,
  value,
  isFirstCondition
) {
  const numericValue =
    Number(
      value
    );
 
 
  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    throw new Error(
      `Montant de la réservation invalide : ${value}`
    );
  }
 
 
  console.log(
    `   → Montant de la réservation ${operator} ${numericValue} €`
  );
 
 
  await addAndCondition(
    page,
    isFirstCondition
  );
 
 
  const search =
    page.getByRole(
      'textbox',
      {
        name:
          'Rechercher'
      }
    );
 
 
  await search.fill(
    'mont'
  );
 
 
  await sleep(
    300
  );
 
 
  const field =
    page.getByRole(
      'link',
      {
        name:
          /Montant de la réservation/i
      }
    );
 
 
  await field.waitFor({
    state:
      'visible',
 
    timeout:
      15000
  });
 
 
  await field.click();
 
 
  await sleep(
    250
  );
 
 
  let experienceOperator;
 
 
  if (
    operator ===
      '>='
  ) {
    experienceOperator =
      'GreaterThanOrEqual';
 
  } else if (
    operator ===
      '='
  ) {
    experienceOperator =
      'Equal';
 
  } else {
    throw new Error(
      `Opérateur montant non supporté : ${operator}`
    );
  }
 
 
  await page
    .locator(
      '#app'
    )
    .getByRole(
      'combobox'
    )
    .selectOption(
      experienceOperator
    );
 
 
  const amountInput =
    page.getByRole(
      'spinbutton'
    );
 
 
  await amountInput.fill(
    String(
      numericValue
    )
  );
 
 
  const actualValue =
    await amountInput.inputValue();
 
 
  console.log(
    `      Valeur demandée : ${numericValue}`
  );
 
 
  console.log(
    `      Valeur Experience : ${actualValue}`
  );
 
 
  await page
    .getByRole(
      'button',
      {
        name:
          'Valider'
      }
    )
    .click();
 
 
  await sleep(
    450
  );
 
 
  console.log(
    '      ✅ Filtre montant validé'
  );
}
 
 
// ============================================================
// P09 — DÉPENSE MOYENNE PAR RÉSERVATION
//
// Source de vérité :
// Analyse base client
// → Profils
// → Dépense moyenne
// → Par réservation (EUR)
//
// IMPORTANT :
// on ne dérive PAS cette valeur du CA CRM.
// ============================================================
 
async function scrapeAverageSpendPerBooking(
  page
) {
  console.log('');
  console.log(
    '💰 Lecture de la dépense moyenne par réservation...'
  );
 
 
  await openCustomerAnalysis(
    page
  );
 
 
  await applyPeriodWithToggle(
    page,
    CONFIG.period
  );
 
 
  const profilesTab =
    page.getByRole(
      'link',
      {
        name:
          'Profils',
 
        exact:
          true
      }
    );
 
 
  if (
    await profilesTab
      .isVisible()
      .catch(
        () =>
          false
      )
  ) {
    await profilesTab.click();
 
 
    await sleep(
      800
    );
  }
 
 
  const chevron =
    page
      .locator(
        '.fal.fa-chevron-double-down'
      )
      .first();
 
 
  if (
    await chevron
      .isVisible()
      .catch(
        () =>
          false
      )
  ) {
    await chevron.click();
 
 
    await sleep(
      500
    );
  }
 
 
  const heading =
    page.getByRole(
      'heading',
      {
        name:
          /Dépense moyenne/i
      }
    );
 
 
  if (
    await heading
      .isVisible()
      .catch(
        () =>
          false
      )
  ) {
    await heading
      .click()
      .catch(
        () => {}
      );
 
 
    await sleep(
      300
    );
  }
 
 
  const reservationCell =
    page.getByRole(
      'cell',
      {
        name:
          /Par réservation \(EUR\)/i
      }
    );
 
 
  await reservationCell.waitFor({
    state:
      'visible',
 
    timeout:
      30000
  });
 
 
  const row =
    reservationCell.locator(
      'xpath=ancestor::tr[1]'
    );
 
 
  const rowText =
    (
      await row
        .innerText()
        .catch(
          () =>
            ''
        )
    )
      .replace(
        /\u00A0/g,
        ' '
      )
      .trim();
 
 
  console.log(
    `   Ligne dépense moyenne : ${rowText}`
  );
 
 
  const numbers =
    rowText.match(
      /\d+(?:[.,]\d+)?/g
    );
 
 
  if (
    !numbers ||
    numbers.length ===
      0
  ) {
    throw new Error(
      'Impossible de lire la dépense moyenne par réservation.'
    );
  }
 
 
  const numericValues =
    numbers
      .map(
        value =>
          Number(
            value.replace(
              ',',
              '.'
            )
          )
      )
      .filter(
        value =>
          Number.isFinite(
            value
          )
      );
 
 
  if (
    numericValues.length ===
      0
  ) {
    throw new Error(
      'Valeur numérique de dépense moyenne introuvable.'
    );
  }
 
 
  const averageSpend =
    numericValues[
      numericValues.length -
      1
    ];
 
 
  console.log(
    `✅ Dépense moyenne par réservation : ${averageSpend} €`
  );
 
 
  return averageSpend;
}
 
 
// ============================================================
// SAUVEGARDE TEMPORAIRE
// ============================================================
 
async function saveTemporaryAudience(
  page,
  tempName
) {
  console.log(
    `\n💾 Enregistrement temporaire : ${tempName}`
  );
 
 
  const nameInput =
    page.getByRole(
      'textbox',
      {
        name:
          'Nom de la liste'
      }
    );
 
 
  await nameInput.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  await nameInput.fill(
    tempName
  );
 
 
  const saveButton =
    page.getByRole(
      'button',
      {
        name:
          'Enregistrer'
      }
    );
 
 
  await saveButton.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  await saveButton.click();
 
 
  await sleep(
    1600
  );
 
 
  console.log(
    '      ✅ Liste temporaire enregistrée'
  );
}
 
 
// ============================================================
// RETOUR AUX LISTES D'ENVOI
// ============================================================
 
async function returnToMailingLists(
  page
) {
  const back =
    page
      .getByRole(
        'link',
        {
          name:
            /Retour aux listes d'envoi/i
        }
      )
      .first();
 
 
  if (
    await back
      .isVisible()
      .catch(
        () =>
          false
      )
  ) {
    await back.click();
 
 
    await sleep(
      1000
    );
 
 
    return;
  }
 
 
  await openMailingLists(
    page
  );
}
 
 
// ============================================================
// RÉOUVERTURE TEMPORAIRE
// ============================================================
 
async function reopenTemporaryAudience(
  page,
  tempName
) {
  console.log(
    '\n🔄 Réouverture de la liste temporaire...'
  );
 
 
  let modify =
    page.getByRole(
      'link',
      {
        name:
          'Modifier',
 
        exact:
          true
      }
    );
 
 
  if (
    await modify
      .isVisible()
      .catch(
        () =>
          false
      )
  ) {
    await modify.click();
 
 
    await sleep(
      1000
    );
 
 
    console.log(
      '      ✅ Liste temporaire ouverte en modification'
    );
 
 
    return;
  }
 
 
  await returnToMailingLists(
    page
  );
 
 
  const exactLink =
    page.getByRole(
      'link',
      {
        name:
          tempName,
 
        exact:
          true
      }
    );
 
 
  if (
    await exactLink
      .isVisible()
      .catch(
        () =>
          false
      )
  ) {
    await exactLink.click();
 
  } else {
    const row =
      page
        .getByRole(
          'row'
        )
        .filter({
          hasText:
            tempName
        })
        .first();
 
 
    await row.waitFor({
      state:
        'visible',
 
      timeout:
        20000
    });
 
 
    const links =
      row.getByRole(
        'link'
      );
 
 
    if (
      await links.count() ===
        0
    ) {
      throw new Error(
        'Liste temporaire retrouvée mais aucun lien disponible.'
      );
    }
 
 
    await links
      .first()
      .click();
  }
 
 
  await sleep(
    800
  );
 
 
  modify =
    page.getByRole(
      'link',
      {
        name:
          'Modifier',
 
        exact:
          true
      }
    );
 
 
  await modify.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  await modify.click();
 
 
  await sleep(
    1000
  );
 
 
  console.log(
    '      ✅ Liste temporaire ouverte en modification'
  );
}
 
 
// ============================================================
// EXTRACTION DU HEADING NUMÉRIQUE
// ============================================================
 
async function extractNumericHeadingFromAnchor(
  anchor
) {
  return anchor.evaluate(
    element => {
 
      function parseHeadingNumber(
        raw
      ) {
        const clean =
          String(
            raw ||
            ''
          )
            .replace(
              /\u00A0/g,
              ''
            )
            .replace(
              /\s+/g,
              ''
            )
            .trim();
 
 
        if (
          /^\d+$/.test(
            clean
          )
        ) {
          return Number(
            clean
          );
        }
 
 
        return null;
      }
 
 
      let parent =
        element;
 
 
      const diagnostics =
        [];
 
 
      for (
        let level = 0;
        level < 12;
        level++
      ) {
        parent =
          parent.parentElement;
 
 
        if (
          !parent
        ) {
          break;
        }
 
 
        const headings =
          Array.from(
            parent.querySelectorAll(
              'h1,h2,h3,h4,h5,h6,[role="heading"]'
            )
          );
 
 
        const numbers =
          [];
 
 
        for (
          const heading
          of headings
        ) {
          const value =
            parseHeadingNumber(
              heading.textContent
            );
 
 
          if (
            value !==
              null
          ) {
            numbers.push(
              value
            );
          }
        }
 
 
        diagnostics.push({
          level,
          numbers
        });
 
 
        if (
          numbers.length ===
            1
        ) {
          return {
 
            success:
              true,
 
            value:
              numbers[0],
 
            level,
 
            method:
              'anchor-parent-single-heading',
 
            diagnostics
          };
        }
      }
 
 
      return {
 
        success:
          false,
 
        diagnostics
      };
    }
  );
}
 
 
// ============================================================
// LECTURE DU VRAI NOMBRE DE DESTINATAIRES NAVI
//
// IMPORTANT :
// 0 destinataire est un résultat valide.
// ============================================================
 
async function getNaviRecipientsCount(
  page
) {
  console.log(
    '\n🎯 Lecture audience NAVI...'
  );
 
 
  const title =
    page.getByRole(
      'heading',
      {
        name:
          /Résultat de la segmentation/i
      }
    );
 
 
  await title.waitFor({
    state:
      'visible',
 
    timeout:
      30000
  });
 
 
  console.log(
    '      ✓ Résultat de la segmentation visible'
  );
 
 
  const naviLabel =
    page
      .getByText(
        /Exclure les clients ayant une réservation future ou présents dans l'établissement/i
      )
      .first();
 
 
  await naviLabel.waitFor({
    state:
      'visible',
 
    timeout:
      30000
  });
 
 
  console.log(
    '      ✓ Bloc NAVI visible'
  );
 
 
  const recipientLabels =
    page.getByText(
      /^Destinataire(?:s)?$/i
    );
 
 
  const recipientCount =
    await recipientLabels.count();
 
 
  console.log(
    `      [DEBUG] ${recipientCount} libellé(s) Destinataire(s) détecté(s)`
  );
 
 
  // ----------------------------------------------------------
  // Méthode historique validée P07
  // ----------------------------------------------------------
 
  if (
    recipientCount >=
      2
  ) {
    const target =
      recipientLabels.nth(
        1
      );
 
 
    const result =
      await extractNumericHeadingFromAnchor(
        target
      );
 
 
    if (
      result.success
    ) {
      console.log(
        `      [DEBUG] méthode : ${result.method}`
      );
 
 
      console.log(
        `      [DEBUG] niveau DOM : ${result.level}`
      );
 
 
      console.log(
        `      ✅ Audience NAVI : ${result.value} destinataire(s)`
      );
 
 
      return Number(
        result.value
      );
    }
  }
 
 
  // ----------------------------------------------------------
  // Fallback validé P02 / P09 / P11
  // ----------------------------------------------------------
 
  console.log(
    '      ↳ Fallback : lecture directe depuis la carte NAVI'
  );
 
 
  const fallback =
    await extractNumericHeadingFromAnchor(
      naviLabel
    );
 
 
  if (
    fallback.success
  ) {
    console.log(
      `      [DEBUG] méthode fallback : ${fallback.method}`
    );
 
 
    console.log(
      `      [DEBUG] niveau DOM fallback : ${fallback.level}`
    );
 
 
    console.log(
      `      ✅ Audience NAVI : ${fallback.value} destinataire(s)`
    );
 
 
    return Number(
      fallback.value
    );
  }
 
 
  throw new Error(
    'Impossible de lire le volume de l’audience NAVI.'
  );
}
 
 
// ============================================================
// SUPPRESSION D'UNE LISTE TEMPORAIRE
// ============================================================
 
async function deleteAudience(
  page,
  listName
) {
  console.log(
    `\n🗑️ Suppression de la liste temporaire : ${listName}`
  );
 
 
  await returnToMailingLists(
    page
  );
 
 
  const row =
    page
      .getByRole(
        'row'
      )
      .filter({
        hasText:
          listName
      })
      .first();
 
 
  await row.waitFor({
    state:
      'visible',
 
    timeout:
      20000
  });
 
 
  const buttons =
    row.getByRole(
      'button'
    );
 
 
  const buttonCount =
    await buttons.count();
 
 
  if (
    buttonCount ===
      0
  ) {
    throw new Error(
      `Bouton d'action introuvable pour ${listName}.`
    );
  }
 
 
  await buttons
    .first()
    .click();
 
 
  await sleep(
    300
  );
 
 
  const deleteButton =
    page.getByRole(
      'button',
      {
        name:
          /Supprimer/i
      }
    );
 
 
  await deleteButton.waitFor({
    state:
      'visible',
 
    timeout:
      10000
  });
 
 
  await deleteButton.click();
 
 
  await sleep(
    300
  );
 
 
  const confirmButton =
    page.getByRole(
      'button',
      {
        name:
          'Oui',
 
        exact:
          true
      }
    );
 
 
  await confirmButton.waitFor({
    state:
      'visible',
 
    timeout:
      10000
  });
 
 
  await confirmButton.click();
 
 
  await sleep(
    1000
  );
 
 
  console.log(
    '      ✅ Liste temporaire supprimée'
  );
}
 
 
// ============================================================
// PREVIEW AUDIENCE
//
// TEMPORAIRE :
// création → calcul → lecture → suppression.
//
// Elle ne crée PAS la liste finale persistante.
// ============================================================
 
async function previewAudience(
  page,
  {
    hotelName,
    playbookId,
    definition,
    dynamicValues = {}
  }
) {
  let tempName =
    null;
 
 
  try {
 
    await openMailingLists(
      page
    );
 
 
    await startNewAudience(
      page
    );
 
 
    await buildAudienceDefinition(
      page,
      definition,
      dynamicValues
    );
 
 
    await recalculateResults(
      page
    );
 
 
    await selectNaviMode(
      page
    );
 
 
    tempName =
      createTempName(
        playbookId,
        hotelName,
        definition.id
      );
 
 
    await saveTemporaryAudience(
      page,
      tempName
    );
 
 
    await reopenTemporaryAudience(
      page,
      tempName
    );
 
 
    const recipients =
      await getNaviRecipientsCount(
        page
      );
 
 
    console.log('');
    console.log(
      '=============================================='
    );
 
    console.log(
      '✅ PREVIEW AUDIENCE NAVI'
    );
 
    console.log(
      '=============================================='
    );
 
    console.log(
      `Audience : ${definition.name}`
    );
 
    console.log(
      `👥 ${formatNumber(
        recipients
      )} destinataire(s)`
    );
 
 
    const deletedTempName =
      tempName;
 
 
    await deleteAudience(
      page,
      tempName
    );
 
 
    tempName =
      null;
 
 
    return {
 
      definitionId:
        definition.id,
 
      name:
        definition.name,
 
      recipients,
 
      recipientMode:
        'exclude_future_and_current_guests',
 
      preview:
        true,
 
      tempName:
        deletedTempName,
 
      status:
        'deleted'
    };
 
  } catch (
    error
  ) {
 
    if (
      tempName
    ) {
      console.log('');
      console.log(
        `⚠️ Nettoyage de sécurité : ${tempName}`
      );
 
 
      try {
        await deleteAudience(
          page,
          tempName
        );
 
 
        tempName =
          null;
 
      } catch (
        cleanupError
      ) {
        console.log(
          `⚠️ Impossible de supprimer automatiquement ${tempName}`
        );
      }
    }
 
 
    throw error;
  }
}
 
 
// ============================================================
// FIN BLOC 5/8
// ============================================================
// ============================================================
// NAVI — BLOC 6/8
// PLAYBOOK ENGINE P01 → P09 + P11
// ============================================================
 
 
// ============================================================
// P11 — CONSTRUCTION D'UNE OPPORTUNITÉ
// ============================================================
 
async function buildP11OpportunityAudience(
  page,
  opportunity
) {
  console.log('');
  console.log(
    '=============================================='
  );
 
  console.log(
    `🧩 ${opportunity.id} — ${opportunity.name}`
  );
 
  console.log(
    '=============================================='
  );
 
 
  let firstCondition =
    true;
 
 
  for (
    const filter
    of opportunity.filters
  ) {
 
    if (
      filter.field ===
        'stayCount'
    ) {
 
      await addStayCountFilter(
        page,
        filter.operator,
        filter.value,
        firstCondition
      );
 
    }
 
    else if (
      filter.field ===
        'lastStayChannel'
    ) {
 
      await addLastStayChannelFilter(
        page,
        filter.value,
        firstCondition
      );
 
    }
 
    else if (
      filter.field ===
        'lastStayDate' &&
      filter.operator ===
        '>='
    ) {
 
      await addLastStayAfterFilter(
        page,
        filter.relativeMonths,
        firstCondition
      );
 
    }
 
    else if (
      filter.field ===
        'lastStayDate' &&
      filter.operator ===
        'between'
    ) {
 
      await addLastStayBetweenFilter(
        page,
        filter.relativeMonthsFrom,
        filter.relativeMonthsTo,
        firstCondition
      );
 
    }
 
    else {
 
      throw new Error(
        `Filtre P11 non pris en charge : ${JSON.stringify(
          filter
        )}`
      );
 
    }
 
 
    firstCondition =
      false;
  }
}
 
 
// ============================================================
// P11 — MESURE D'UNE OPPORTUNITÉ
// ============================================================
 
async function measureP11Opportunity(
  page,
  opportunity,
  usableProfiles,
  hotelName
) {
 
  await startNewAudience(
    page
  );
 
 
  await buildP11OpportunityAudience(
    page,
    opportunity
  );
 
 
  await recalculateResults(
    page
  );
 
 
  await selectNaviMode(
    page
  );
 
 
  const tempName =
    createTempName(
      'P11',
      hotelName,
      opportunity.id
    );
 
 
  await saveTemporaryAudience(
    page,
    tempName
  );
 
 
  await reopenTemporaryAudience(
    page,
    tempName
  );
 
 
  const recipients =
    await getNaviRecipientsCount(
      page
    );
 
 
  const scoring =
    calculateOpportunityScore(
      opportunity,
      recipients
    );
 
 
  console.log('');
 
  console.log(
    `📊 ${opportunity.name}`
  );
 
 
  console.log(
    `   👥 ${formatNumber(
      recipients
    )} destinataire(s)`
  );
 
 
  console.log(
    `   Volume          : ${scoring.volumeScore}/50`
  );
 
 
  console.log(
    `   Potentiel       : ${scoring.potentialScore}/30`
  );
 
 
  console.log(
    `   Actionnabilité  : ${scoring.actionabilityScore}/20`
  );
 
 
  console.log(
    `   ⭐ SCORE P11     : ${scoring.totalScore}/100`
  );
 
 
  console.log(
    `   → ${scoring.level}`
  );
 
 
  await deleteAudience(
    page,
    tempName
  );
 
 
  return {
 
    id:
      opportunity.id,
 
    name:
      opportunity.name,
 
    description:
      opportunity.description,
 
    recipients,
 
    scores: {
 
      relativeVolume:
        scoring.volumeScore,
 
      potential:
        scoring.potentialScore,
 
      actionability:
        scoring.actionabilityScore,
 
      total:
        scoring.totalScore
    },
 
    level:
      scoring.level,
 
    tempName,
 
    status:
      'deleted'
  };
}
 
 
// ============================================================
// P11 — CLASSEMENT
// ============================================================
 
function rankP11Opportunities(
  results
) {
 
  return [
    ...results
  ].sort(
    (
      a,
      b
    ) => {
 
      // 1. Score total
 
      if (
        b.scores.total !==
        a.scores.total
      ) {
 
        return (
          b.scores.total -
          a.scores.total
        );
      }
 
 
      // 2. Potentiel intrinsèque
 
      if (
        b.scores.potential !==
        a.scores.potential
      ) {
 
        return (
          b.scores.potential -
          a.scores.potential
        );
      }
 
 
      // 3. Volume réel
 
      return (
        b.recipients -
        a.recipients
      );
    }
  );
}
 
 
// ============================================================
// P11 — OPPORTUNITY FINDER COMPLET
// ============================================================
 
async function runP11OpportunityFinder(
  page,
  scanResult
) {
 
  console.log('');
  console.log(
    '======================================================'
  );
 
  console.log(
    '🔎 P11 — BASE CRM SOUS-EXPLOITÉE'
  );
 
  console.log(
    '======================================================'
  );
 
 
  const usableProfiles =
    Number(
      scanResult
        ?.base
        ?.usableEmails
    );
 
 
  if (
    !Number.isFinite(
      usableProfiles
    ) ||
    usableProfiles <=
      0
  ) {
 
    throw new Error(
      'Base activable invalide : P11 ne peut pas calculer les opportunités.'
    );
  }
 
 
  console.log(
    `📦 Base activable : ${formatNumber(
      usableProfiles
    )} profils`
  );
 
 
  console.log('');
  console.log(
    'NAVI va mesurer 3 audiences :'
  );
 
  console.log(
    '   1. One-timers à réactiver'
  );
 
  console.log(
    '   2. Repeaters dormants'
  );
 
  console.log(
    '   3. OTA convertibles'
  );
 
 
  const shouldPreview =
    await askYesNo(
      '\nSouhaites-tu lancer l’Opportunity Finder P11 ?'
    );
 
 
  if (
    !shouldPreview
  ) {
 
    console.log(
      '⏭️ Opportunity Finder P11 ignoré.'
    );
 
 
    return {
 
      playbookId:
        'P11',
 
      executed:
        false,
 
      reason:
        'user_declined'
    };
  }
 
 
  await openMailingLists(
    page
  );
 
 
  const results =
    [];
 
 
  for (
    let i = 0;
    i <
      P11_OPPORTUNITIES.length;
    i++
  ) {
 
    const opportunity =
      P11_OPPORTUNITIES[
        i
      ];
 
 
    console.log('');
    console.log(
      `🔎 Recherche opportunité ${i + 1}/${P11_OPPORTUNITIES.length}`
    );
 
 
    const result =
      await measureP11Opportunity(
        page,
        opportunity,
        usableProfiles,
        scanResult.hotel
      );
 
 
    results.push(
      result
    );
 
 
    if (
      i <
      P11_OPPORTUNITIES.length -
        1
    ) {
 
      await openMailingLists(
        page
      );
    }
  }
 
 
  const ranked =
    rankP11Opportunities(
      results
    );
 
 
  const recommendable =
    ranked.filter(
      result =>
        result.scores.total >=
        40
    );
 
 
  const recommended =
    recommendable.length >
      0
      ? recommendable[0]
      : null;
 
 
  console.log('');
  console.log(
    '======================================================'
  );
 
  console.log(
    '           NAVI — P11 OPPORTUNITY SCORING'
  );
 
  console.log(
    '======================================================'
  );
 
  console.log('');
 
  console.log(
    `🏨 Hôtel : ${scanResult.hotel}`
  );
 
  console.log(
    `📦 Base activable : ${formatNumber(
      usableProfiles
    )} profils`
  );
 
  console.log('');
 
 
  if (
    recommended
  ) {
 
    console.log(
      '🎯 AUDIENCE RECOMMANDÉE EN PRIORITÉ'
    );
 
    console.log('');
 
    console.log(
      `   ${recommended.name}`
    );
 
    console.log(
      `   👥 ${formatNumber(
        recommended.recipients
      )} destinataire(s)`
    );
 
    console.log(
      `   ⭐ ${recommended.scores.total}/100 — ${recommended.level}`
    );
 
    console.log('');
 
  } else {
 
    console.log(
      '⚪ Aucune audience P11 suffisamment pertinente.'
    );
 
    console.log(
      '   Toutes les opportunités ont un score inférieur à 40/100.'
    );
 
    console.log('');
  }
 
 
  console.log(
    '------------------------------------------------------'
  );
 
  console.log(
    'CLASSEMENT COMPLET'
  );
 
  console.log(
    '------------------------------------------------------'
  );
 
 
  ranked.forEach(
    (
      result,
      index
    ) => {
 
      const medals = [
        '🥇',
        '🥈',
        '🥉'
      ];
 
 
      console.log('');
 
      console.log(
        `${medals[index] || '•'} ${index + 1}. ${result.name}`
      );
 
      console.log(
        `   👥 Audience       : ${formatNumber(
          result.recipients
        )}`
      );
 
      console.log(
        `   Volume           : ${result.scores.relativeVolume}/50`
      );
 
      console.log(
        `   Potentiel        : ${result.scores.potential}/30`
      );
 
      console.log(
        `   Actionnabilité   : ${result.scores.actionability}/20`
      );
 
      console.log(
        `   ⭐ SCORE TOTAL    : ${result.scores.total}/100`
      );
 
      console.log(
        `   → ${result.level}`
      );
    }
  );
 
 
  console.log('');
  console.log(
    '🚫 Réservations futures + clients présents exclus'
  );
 
  console.log(
    '🧹 Toutes les listes temporaires ont été supprimées.'
  );
 
 
  return {
 
    playbookId:
      'P11',
 
    executed:
      true,
 
    usableProfiles,
 
    recommended,
 
    ranking:
      ranked
  };
}
 
 
// ============================================================
// PLAYBOOK SIMPLE AVEC AUDIENCE
//
// P02 / P03 / P04 / P06 / P07 / P09
// ============================================================
 
async function runSimpleAudiencePlaybook(
  page,
  scanResult,
  signal
) {
 
  const playbookId =
    signal.id;
 
 
  const catalog =
    PLAYBOOK_CATALOG[
      playbookId
    ];
 
 
  const definition =
    AUDIENCE_DEFINITIONS[
      catalog?.audience
    ];
 
 
  if (
    !definition
  ) {
 
    throw new Error(
      `Définition Audience Builder absente pour ${playbookId}.`
    );
  }
 
 
  console.log('');
  console.log(
    '======================================================'
  );
 
  console.log(
    `🎯 ${playbookId} — ${catalog?.name || signal.name}`
  );
 
  console.log(
    '======================================================'
  );
 
 
  if (
    catalog?.recommendation
  ) {
 
    console.log('');
    console.log(
      '💡 Action recommandée'
    );
 
    console.log(
      catalog.recommendation
    );
  }
 
 
  console.log('');
  console.log(
    '👥 Audience NAVI proposée'
  );
 
  console.log(
    definition.description ||
    definition.name ||
    definition.id
  );
 
 
  const shouldPreview =
    await askYesNo(
      '\nSouhaites-tu prévisualiser cette audience ?'
    );
 
 
  if (
    !shouldPreview
  ) {
 
    console.log(
      '⏭️ Audience non prévisualisée.'
    );
 
 
    return {
 
      playbookId,
 
      executed:
        false,
 
      preview:
        false,
 
      reason:
        'user_declined'
    };
  }
 
 
  const dynamicValues =
    {};
 
 
  // ----------------------------------------------------------
  // P09
  // Le seuil est la dépense moyenne PAR RÉSERVATION
  // de la période sélectionnée.
  // ----------------------------------------------------------
 
  if (
    playbookId ===
      'P09'
  ) {
 
    const averageSpend =
      await scrapeAverageSpendPerBooking(
        page
      );
 
 
    dynamicValues.averageSpend =
      averageSpend;
 
 
    console.log(
      `🎯 Seuil P09 : ${averageSpend} €`
    );
  }
 
 
  const preview =
    await previewAudience(
      page,
      {
 
        hotelName:
          scanResult.hotel,
 
        playbookId,
 
        definition,
 
        dynamicValues
      }
    );
 
 
  return {
 
    playbookId,
 
    executed:
      true,
 
    preview:
      true,
 
    audience:
      preview,
 
    dynamicValues
  };
}
 
 
// ============================================================
// PLAYBOOK SANS AUDIENCE AUTOMATIQUE
// ============================================================
 
async function runNoAudiencePlaybook(
  scanResult,
  signal
) {
 
  const catalog =
    PLAYBOOK_CATALOG[
      signal.id
    ];
 
 
  console.log('');
  console.log(
    '======================================================'
  );
 
  console.log(
    `💡 ${signal.id} — ${catalog?.name || signal.name}`
  );
 
  console.log(
    '======================================================'
  );
 
 
  if (
    catalog?.recommendation
  ) {
 
    console.log('');
    console.log(
      catalog.recommendation
    );
  }
 
 
  console.log('');
 
 
  // ----------------------------------------------------------
  // P01
  // ----------------------------------------------------------
 
  if (
    signal.id ===
      'P01'
  ) {
 
    console.log(
      '👥 Audience NAVI : aucune'
    );
 
    console.log(
      '→ Action opérationnelle sur la captation.'
    );
  }
 
 
  // ----------------------------------------------------------
  // P05
  // ----------------------------------------------------------
 
  else if (
    signal.id ===
      'P05'
  ) {
 
    console.log(
      '👥 Audience NAVI : toute la base exploitable'
    );
 
    console.log(
      '→ Déclencher la stratégie Low Perf.'
    );
 
    console.log(
      '→ Aucun Audience Builder spécifique nécessaire.'
    );
  }
 
 
  // ----------------------------------------------------------
  // P08
  // ----------------------------------------------------------
 
  else if (
    signal.id ===
      'P08'
  ) {
 
    console.log(
      '👥 Audience NAVI : aucune audience automatique'
    );
 
    console.log(
      '→ NAVI contextualise la baisse de fidélisation avec les autres KPI avant toute recommandation.'
    );
  }
 
 
  // ----------------------------------------------------------
  // P12
  // ----------------------------------------------------------
 
  else if (
    signal.id ===
      'P12'
  ) {
 
    console.log(
      '👥 Audience NAVI : aucune par défaut'
    );
 
    console.log(
      '→ Une forte part des réservations CRM issue des automations peut être saine.'
    );
 
    console.log(
      '→ NAVI recherche seulement une opportunité pertinente de campagne ponctuelle complémentaire.'
    );
  }
 
 
  return {
 
    playbookId:
      signal.id,
 
    executed:
      true,
 
    audience:
      null,
 
    mode:
      'no_automatic_audience'
  };
}
 
 
// ============================================================
// ROUTEUR PLAYBOOK
// ============================================================
 
async function runPlaybookForSignal(
  page,
  scanResult,
  signal
) {
 
  switch (
    signal.id
  ) {
 
    // --------------------------------------------------------
    // P01 — Captation insuffisante
    // --------------------------------------------------------
 
    case 'P01':
 
      return await runNoAudiencePlaybook(
        scanResult,
        signal
      );
 
 
    // --------------------------------------------------------
    // P02 — Collecte CRM critique
    // --------------------------------------------------------
 
    case 'P02':
 
      return await runSimpleAudiencePlaybook(
        page,
        scanResult,
        signal
      );
 
 
    // --------------------------------------------------------
    // P03 — Déperdition après collecte
    // --------------------------------------------------------
 
    case 'P03':
 
      return await runSimpleAudiencePlaybook(
        page,
        scanResult,
        signal
      );
 
 
    // --------------------------------------------------------
    // P04 — Base activable insuffisante
    // --------------------------------------------------------
 
    case 'P04':
 
      return await runSimpleAudiencePlaybook(
        page,
        scanResult,
        signal
      );
 
 
    // --------------------------------------------------------
    // P05 — Forte dépendance OTA
    // --------------------------------------------------------
 
    case 'P05':
 
      return await runNoAudiencePlaybook(
        scanResult,
        signal
      );
 
 
    // --------------------------------------------------------
    // P06 — Potentiel OTA → Direct
    // --------------------------------------------------------
 
    case 'P06':
 
      return await runSimpleAudiencePlaybook(
        page,
        scanResult,
        signal
      );
 
 
    // --------------------------------------------------------
    // P07 — Faible fidélisation
    // --------------------------------------------------------
 
    case 'P07':
 
      return await runSimpleAudiencePlaybook(
        page,
        scanResult,
        signal
      );
 
 
    // --------------------------------------------------------
    // P08 — Fidélisation en recul
    // --------------------------------------------------------
 
    case 'P08':
 
      return await runNoAudiencePlaybook(
        scanResult,
        signal
      );
 
 
    // --------------------------------------------------------
    // P09 — Potentiel fidélisation inexploité
    // --------------------------------------------------------
 
    case 'P09':
 
      return await runSimpleAudiencePlaybook(
        page,
        scanResult,
        signal
      );
 
 
    // --------------------------------------------------------
    // P10
    //
    // Géré dans le BLOC 7 :
    // diagnostic automations + recommandations mensuelles.
    // --------------------------------------------------------
 
    case 'P10':
 
      return await runP10Playbook(
        page,
        scanResult,
        signal
      );
 
 
    // --------------------------------------------------------
    // P11 — Opportunity Finder
    // --------------------------------------------------------
 
    case 'P11':
 
      return await runP11OpportunityFinder(
        page,
        scanResult
      );
 
 
    // --------------------------------------------------------
    // P12 — Concentration automations
    // --------------------------------------------------------
 
    case 'P12':
 
      return await runNoAudiencePlaybook(
        scanResult,
        signal
      );
 
 
    default:
 
      console.log(
        `⚠️ Aucun playbook disponible pour ${signal.id}`
      );
 
 
      return {
 
        playbookId:
          signal.id,
 
        executed:
          false,
 
        reason:
          'unsupported_playbook'
      };
  }
}
 
 
// ============================================================
// EXÉCUTION DE TOUS LES PLAYBOOKS DÉTECTÉS
// ============================================================
 
async function runDetectedPlaybooks(
  page,
  scanResult
) {
 
  const signals =
    Array.isArray(
      scanResult.signals
    )
      ? scanResult.signals
      : [];
 
 
  console.log('');
  console.log(
    '======================================================'
  );
 
  console.log(
    '🧭 NAVI — OPPORTUNITÉS & PLAYBOOKS'
  );
 
  console.log(
    '======================================================'
  );
 
 
  if (
    signals.length ===
      0
  ) {
 
    console.log('');
    console.log(
      '⚪ Aucun signal actionnable détecté.'
    );
 
    console.log(
      '→ Aucun playbook à proposer pour ce scan.'
    );
 
 
    return [];
  }
 
 
  console.log('');
  console.log(
    `${signals.length} signal(s) détecté(s) :`
  );
 
 
  signals.forEach(
    signal => {
 
      const catalog =
        PLAYBOOK_CATALOG[
          signal.id
        ];
 
 
      console.log(
        `   • ${signal.id} — ${catalog?.name || signal.name}`
      );
    }
  );
 
 
  const results =
    [];
 
 
  for (
    let i = 0;
    i <
      signals.length;
    i++
  ) {
 
    const signal =
      signals[i];
 
 
    console.log('');
    console.log(
      `──────────────────────────────────────────────────────`
    );
 
    console.log(
      `PLAYBOOK ${i + 1}/${signals.length}`
    );
 
    console.log(
      `──────────────────────────────────────────────────────`
    );
 
 
    try {
 
      const result =
        await runPlaybookForSignal(
          page,
          scanResult,
          signal
        );
 
 
      results.push(
        result
      );
 
    } catch (
      error
    ) {
 
      console.log('');
      console.log(
        `❌ Erreur playbook ${signal.id} : ${error.message}`
      );
 
 
      results.push({
 
        playbookId:
          signal.id,
 
        executed:
          false,
 
        error:
          error.message
      });
    }
  }
 
 
  return results;
}
 
 
// ============================================================
// FIN BLOC 6/8
// ============================================================
// ============================================================
// NAVI — BLOC 7/8
// P10 — AUTOMATIONS + RECOMMANDATIONS + AUDIENCE BUILDER
// ============================================================
 
 
// ============================================================
// OUTILS LISTES P10
// ============================================================
 
async function selectListValue(
  page,
  value
) {
  console.log(
    `      → Recherche valeur : ${value}`
  );
 
 
  let option =
    page.getByRole(
      'option',
      {
        name:
          value,
 
        exact:
          true
      }
    );
 
 
  if (
    await option
      .isVisible()
      .catch(
        () =>
          false
      )
  ) {
    await option.click();
 
    console.log(
      `      ✓ ${value}`
    );
 
    return;
  }
 
 
  const comboboxes =
    page.getByRole(
      'combobox'
    );
 
 
  const comboCount =
    await comboboxes.count();
 
 
  for (
    let i =
      comboCount - 1;
    i >= 0;
    i--
  ) {
    const combo =
      comboboxes.nth(
        i
      );
 
 
    if (
      await combo
        .isVisible()
        .catch(
          () =>
            false
        )
    ) {
      const tagName =
        await combo
          .evaluate(
            el =>
              el.tagName
                .toLowerCase()
          )
          .catch(
            () =>
              ''
          );
 
 
      if (
        tagName !==
          'select'
      ) {
        await combo
          .click()
          .catch(
            () => {}
          );
 
 
        await sleep(
          300
        );
 
 
        option =
          page.getByRole(
            'option',
            {
              name:
                value,
 
              exact:
                true
            }
          );
 
 
        if (
          await option
            .isVisible()
            .catch(
              () =>
                false
            )
        ) {
          await option.click();
 
          console.log(
            `      ✓ ${value}`
          );
 
          return;
        }
      }
    }
  }
 
 
  const searchboxes =
    page.getByRole(
      'searchbox'
    );
 
 
  const searchCount =
    await searchboxes.count();
 
 
  for (
    let i =
      searchCount - 1;
    i >= 0;
    i--
  ) {
    const search =
      searchboxes.nth(
        i
      );
 
 
    if (
      await search
        .isVisible()
        .catch(
          () =>
            false
        )
    ) {
      await search
        .fill(
          value
        )
        .catch(
          () =>
            null
        );
 
 
      await sleep(
        400
      );
 
 
      option =
        page.getByRole(
          'option',
          {
            name:
              value,
 
            exact:
              true
          }
        );
 
 
      if (
        await option
          .isVisible()
          .catch(
            () =>
              false
          )
      ) {
        await option.click();
 
        console.log(
          `      ✓ ${value}`
        );
 
        return;
      }
    }
  }
 
 
  const exactText =
    page.getByText(
      value,
      {
        exact:
          true
      }
    );
 
 
  const textCount =
    await exactText.count();
 
 
  for (
    let i = 0;
    i < textCount;
    i++
  ) {
    const candidate =
      exactText.nth(
        i
      );
 
 
    if (
      await candidate
        .isVisible()
        .catch(
          () =>
            false
        )
    ) {
      await candidate.click();
 
      console.log(
        `      ✓ ${value} (fallback texte)`
      );
 
      return;
    }
  }
 
 
  throw new Error(
    `Impossible de sélectionner "${value}".`
  );
}
 
 
async function selectListOperator(
  page,
  operatorValue
) {
  const combos =
    page.getByRole(
      'combobox'
    );
 
 
  const count =
    await combos.count();
 
 
  for (
    let i = 0;
    i < count;
    i++
  ) {
    const combo =
      combos.nth(
        i
      );
 
 
    if (
      !await combo
        .isVisible()
        .catch(
          () =>
            false
        )
    ) {
      continue;
    }
 
 
    const tagName =
      await combo
        .evaluate(
          el =>
            el.tagName
              .toLowerCase()
        )
        .catch(
          () =>
            ''
        );
 
 
    if (
      tagName !==
        'select'
    ) {
      continue;
    }
 
 
    const values =
      await combo
        .locator(
          'option'
        )
        .evaluateAll(
          nodes =>
            nodes.map(
              node =>
                node.value
            )
        )
        .catch(
          () =>
            []
        );
 
 
    if (
      values.includes(
        operatorValue
      )
    ) {
      await combo.selectOption(
        operatorValue
      );
 
 
      await sleep(
        250
      );
 
 
      return;
    }
  }
 
 
  throw new Error(
    `Opérateur ${operatorValue} introuvable.`
  );
}
 
 
// ============================================================
// P10 — ONE-TIMERS
// ============================================================
 
async function addOneTimerFilter(
  page
) {
  console.log(
    '   → Nombre de réservations total = 1'
  );
 
 
  await addAndCondition(
    page,
    true
  );
 
 
  const search =
    page.getByRole(
      'textbox',
      {
        name:
          'Rechercher'
      }
    );
 
 
  await search.fill(
    'nombre'
  );
 
 
  await sleep(
    300
  );
 
 
  await page
    .getByRole(
      'link',
      {
        name:
          'Nombre de réservations total'
      }
    )
    .click();
 
 
  await sleep(
    250
  );
 
 
  await page
    .locator(
      '#app'
    )
    .getByRole(
      'combobox'
    )
    .selectOption(
      'Equal'
    );
 
 
  await page
    .getByRole(
      'spinbutton'
    )
    .fill(
      '1'
    );
 
 
  await page
    .getByRole(
      'button',
      {
        name:
          'Valider'
      }
    )
    .click();
 
 
  await sleep(
    450
  );
 
 
  console.log(
    '      ✅ Filtre One-timers validé'
  );
}
 
 
// ============================================================
// P10 — BUSINESS
// ============================================================
 
async function addBusinessFilter(
  page
) {
  console.log(
    "   → Raison de la visite IN [Salon/Séminaire, Voyage d'affaires]"
  );
 
 
  await addAndCondition(
    page,
    true
  );
 
 
  const search =
    page.getByRole(
      'textbox',
      {
        name:
          'Rechercher'
      }
    );
 
 
  await search.fill(
    'raison'
  );
 
 
  await sleep(
    300
  );
 
 
  await page
    .getByRole(
      'link',
      {
        name:
          /Raison de la visite/i
      }
    )
    .click();
 
 
  await sleep(
    350
  );
 
 
  await selectListOperator(
    page,
    'In'
  );
 
 
  await selectListValue(
    page,
    'Pour un salon ou un séminaire'
  );
 
 
  await selectListValue(
    page,
    "Voyage d'affaires"
  );
 
 
  await page
    .getByRole(
      'button',
      {
        name:
          'Valider'
      }
    )
    .click();
 
 
  await sleep(
    450
  );
 
 
  console.log(
    '      ✅ Filtre Business validé'
  );
}
 
 
// ============================================================
// P10 — VIENT SOUVENT DANS LA RÉGION / VILLE
// ============================================================
 
async function addFrequentDestinationFilter(
  page
) {
  console.log(
    '   → Vient souvent dans la ville/région = oui'
  );
 
 
  await addAndCondition(
    page,
    true
  );
 
 
  const search =
    page.getByRole(
      'textbox',
      {
        name:
          'Rechercher'
      }
    );
 
 
  await search.fill(
    'vient souvent'
  );
 
 
  await sleep(
    300
  );
 
 
  const field =
    page.getByRole(
      'link',
      {
        name:
          /Vient souvent dans la ville\/r/i
      }
    );
 
 
  await field.waitFor({
    state:
      'visible',
 
    timeout:
      15000
  });
 
 
  await field.click();
 
 
  await sleep(
    350
  );
 
 
  await selectListValue(
    page,
    'oui'
  );
 
 
  await page
    .getByRole(
      'button',
      {
        name:
          'Valider'
      }
    )
    .click();
 
 
  await sleep(
    450
  );
 
 
  console.log(
    '      ✅ Filtre fréquent destination validé'
  );
}
 
 
// ============================================================
// P10 — CLIENTS À FORTE VALEUR
// ============================================================
 
async function addHighValueFilter(
  page,
  averageSpend
) {
  console.log(
    `   → Montant de la réservation >= ${averageSpend} €`
  );
 
 
  await addAndCondition(
    page,
    true
  );
 
 
  const search =
    page.getByRole(
      'textbox',
      {
        name:
          'Rechercher'
      }
    );
 
 
  await search.fill(
    'mont'
  );
 
 
  await sleep(
    300
  );
 
 
  const field =
    page.getByRole(
      'link',
      {
        name:
          /Montant de la réservation/i
      }
    );
 
 
  await field.waitFor({
    state:
      'visible',
 
    timeout:
      15000
  });
 
 
  await field.click();
 
 
  await sleep(
    250
  );
 
 
  await page
    .locator(
      '#app'
    )
    .getByRole(
      'combobox'
    )
    .selectOption(
      'GreaterThanOrEqual'
    );
 
 
  const amountInput =
    page.getByRole(
      'spinbutton'
    );
 
 
  await amountInput.fill(
    String(
      averageSpend
    )
  );
 
 
  console.log(
    `      Valeur Experience : ${await amountInput.inputValue()}`
  );
 
 
  await page
    .getByRole(
      'button',
      {
        name:
          'Valider'
      }
    )
    .click();
 
 
  await sleep(
    450
  );
 
 
  console.log(
    '      ✅ Filtre Clients à forte valeur validé'
  );
}
 
 
// ============================================================
// P10 — ZONE OR
// ============================================================
 
async function addOrCondition(
  page
) {
  const zones =
    page
      .locator(
        'div'
      )
      .filter({
        hasText:
          /^Ajouter une condition$/
      });
 
 
  const count =
    await zones.count();
 
 
  console.log(
    `      [DEBUG OR] ${count} zone(s) "Ajouter une condition" trouvée(s)`
  );
 
 
  if (
    count <
      1
  ) {
    throw new Error(
      'Zone OR "Ajouter une condition" introuvable.'
    );
  }
 
 
  await zones
    .last()
    .click();
 
 
  await sleep(
    350
  );
}
 
 
// ============================================================
// P10 — COUPLES
//
// Segment visiteur = En couple
// OR
// Raison de la visite = Voyage de noces
// ============================================================
 
async function addCoupleFilter(
  page
) {
  console.log(
    '   → Couples = Segment visiteur "En couple" OR Raison de la visite "Voyage de noces"'
  );
 
 
  await addAndCondition(
    page,
    true
  );
 
 
  let search =
    page.getByRole(
      'textbox',
      {
        name:
          'Rechercher'
      }
    );
 
 
  await search.fill(
    'segment'
  );
 
 
  await sleep(
    300
  );
 
 
  await page
    .getByRole(
      'link',
      {
        name:
          /Segment visiteur/i
      }
    )
    .click();
 
 
  await sleep(
    350
  );
 
 
  await selectListOperator(
    page,
    'In'
  );
 
 
  await selectListValue(
    page,
    'En couple'
  );
 
 
  await page
    .getByRole(
      'button',
      {
        name:
          'Valider'
      }
    )
    .click();
 
 
  await sleep(
    500
  );
 
 
  await addOrCondition(
    page
  );
 
 
  search =
    page.getByRole(
      'textbox',
      {
        name:
          'Rechercher'
      }
    );
 
 
  await search.fill(
    'raison'
  );
 
 
  await sleep(
    300
  );
 
 
  await page
    .getByRole(
      'link',
      {
        name:
          /Raison de la visite/i
      }
    )
    .click();
 
 
  await sleep(
    350
  );
 
 
  await selectListOperator(
    page,
    'In'
  );
 
 
  await selectListValue(
    page,
    'Voyage de noces'
  );
 
 
  await page
    .getByRole(
      'button',
      {
        name:
          'Valider'
      }
    )
    .click();
 
 
  await sleep(
    500
  );
 
 
  console.log(
    '      ✅ Filtre Couples construit'
  );
}
 
 
// ============================================================
// P10 — REPEATERS
// ============================================================
 
async function addRepeatersFilter(
  page
) {
  console.log(
    '   → Nombre de réservations total >= 2'
  );
 
 
  await addAndCondition(
    page,
    true
  );
 
 
  const search =
    page.getByRole(
      'textbox',
      {
        name:
          'Rechercher'
      }
    );
 
 
  await search.fill(
    'nombre'
  );
 
 
  await sleep(
    300
  );
 
 
  await page
    .getByRole(
      'link',
      {
        name:
          'Nombre de réservations total'
      }
    )
    .click();
 
 
  await sleep(
    250
  );
 
 
  await page
    .locator(
      '#app'
    )
    .getByRole(
      'combobox'
    )
    .selectOption(
      'GreaterThanOrEqual'
    );
 
 
  await page
    .getByRole(
      'spinbutton'
    )
    .fill(
      '2'
    );
 
 
  await page
    .getByRole(
      'button',
      {
        name:
          'Valider'
      }
    )
    .click();
 
 
  await sleep(
    450
  );
 
 
  console.log(
    '      ✅ Filtre Repeaters validé'
  );
}
 
 
// ============================================================
// P10 — CLIENTÈLE NATIONALE
// ============================================================
 
async function addNationalAudienceFilter(
  page
) {
  console.log(
    '   → Pays du client = France'
  );
 
 
  await addAndCondition(
    page,
    true
  );
 
 
  const search =
    page.getByRole(
      'textbox',
      {
        name:
          'Rechercher'
      }
    );
 
 
  await search.fill(
    'pays'
  );
 
 
  await sleep(
    300
  );
 
 
  await page
    .getByRole(
      'link',
      {
        name:
          /Pays du client/i
      }
    )
    .click();
 
 
  await sleep(
    350
  );
 
 
  await selectListOperator(
    page,
    'In'
  );
 
 
  await selectListValue(
    page,
    'France'
  );
 
 
  await page
    .getByRole(
      'button',
      {
        name:
          'Valider'
      }
    )
    .click();
 
 
  await sleep(
    450
  );
 
 
  console.log(
    '      ✅ Filtre Clientèle nationale validé'
  );
}
 
 
// ============================================================
// P10 — LOISIRS
// ============================================================
 
async function addLeisureAudienceFilter(
  page
) {
  console.log(
    "   → Raison de la visite NOT IN [Salon/Séminaire, Voyage d'affaires]"
  );
 
 
  await addAndCondition(
    page,
    true
  );
 
 
  const search =
    page.getByRole(
      'textbox',
      {
        name:
          'Rechercher'
      }
    );
 
 
  await search.fill(
    'raison'
  );
 
 
  await sleep(
    300
  );
 
 
  await page
    .getByRole(
      'link',
      {
        name:
          /Raison de la visite/i
      }
    )
    .click();
 
 
  await sleep(
    350
  );
 
 
  await selectListOperator(
    page,
    'NotIn'
  );
 
 
  await selectListValue(
    page,
    'Pour un salon ou un séminaire'
  );
 
 
  await selectListValue(
    page,
    "Voyage d'affaires"
  );
 
 
  await page
    .getByRole(
      'button',
      {
        name:
          'Valider'
      }
    )
    .click();
 
 
  await sleep(
    450
  );
 
 
  console.log(
    '      ✅ Filtre Loisirs validé'
  );
}
 
 
// ============================================================
// P10 — COUPLES + LOISIRS
//
// ATTENTION :
// c'est bien un OU.
//
// Segment visiteur = En couple
// OR
// Raison de la visite NOT IN business
//
// On n'ajoute PAS Voyage de noces séparément ici.
// ============================================================
 
async function addCouplesLeisureFilter(
  page
) {
  console.log(
    '   → Couples + Loisirs en OU'
  );
 
 
  await addAndCondition(
    page,
    true
  );
 
 
  let search =
    page.getByRole(
      'textbox',
      {
        name:
          'Rechercher'
      }
    );
 
 
  await search.fill(
    'segment'
  );
 
 
  await sleep(
    300
  );
 
 
  await page
    .getByRole(
      'link',
      {
        name:
          /Segment visiteur/i
      }
    )
    .click();
 
 
  await sleep(
    350
  );
 
 
  await selectListOperator(
    page,
    'In'
  );
 
 
  await selectListValue(
    page,
    'En couple'
  );
 
 
  await page
    .getByRole(
      'button',
      {
        name:
          'Valider'
      }
    )
    .click();
 
 
  await sleep(
    500
  );
 
 
  await addOrCondition(
    page
  );
 
 
  search =
    page.getByRole(
      'textbox',
      {
        name:
          'Rechercher'
      }
    );
 
 
  await search.fill(
    'raison'
  );
 
 
  await sleep(
    300
  );
 
 
  await page
    .getByRole(
      'link',
      {
        name:
          /Raison de la visite/i
      }
    )
    .click();
 
 
  await sleep(
    350
  );
 
 
  await selectListOperator(
    page,
    'NotIn'
  );
 
 
  await selectListValue(
    page,
    'Pour un salon ou un séminaire'
  );
 
 
  await selectListValue(
    page,
    "Voyage d'affaires"
  );
 
 
  await page
    .getByRole(
      'button',
      {
        name:
          'Valider'
      }
    )
    .click();
 
 
  await sleep(
    500
  );
 
 
  console.log(
    '      ✅ Filtre Couples + Loisirs construit en OU'
  );
}
 
 
// ============================================================
// P10 — NORMALISATION
// ============================================================
 
function normalizeTextP10(
  value
) {
  return String(
    value ||
    ''
  )
    .replace(
      /\u00A0/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}
 
 
function normalizeCompareP10(
  value
) {
  return normalizeTextP10(
    value
  )
    .normalize(
      'NFD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase();
}
 
 
// ============================================================
// P10 — AUTOMATIONS MARKETING
// ============================================================
 
const ALLOWED_INACTIVE_CAMPAIGNS_P10 = [
 
  'Campagne IT/ES/PT: Printemps',
 
  'Campagne Tarif Entreprise'
 
];
 
 
async function openAutomationStatusP10(
  page
) {
  console.log('');
  console.log(
    '🤖 Vérification des automations marketing...'
  );
 
 
  const changeSpace =
    page.getByRole(
      'button',
      {
        name:
          /Changer d'espace/i
      }
    );
 
 
  await changeSpace.waitFor({
    state:
      'visible',
 
    timeout:
      30000
  });
 
 
  await changeSpace.click();
 
 
  const campaigns =
    page.getByRole(
      'button',
      {
        name:
          /Campagnes/i
      }
    );
 
 
  await campaigns.waitFor({
    state:
      'visible',
 
    timeout:
      30000
  });
 
 
  await campaigns.click();
 
 
  const automated =
    page.getByRole(
      'link',
      {
        name:
          /Marketing automatisé/i
      }
    );
 
 
  await automated.waitFor({
    state:
      'visible',
 
    timeout:
      30000
  });
 
 
  await automated.click();
 
 
  const quickActivation =
    page.getByRole(
      'link',
      {
        name:
          /Activation rapide/i
      }
    );
 
 
  await quickActivation.waitFor({
    state:
      'visible',
 
    timeout:
      30000
  });
 
 
  await quickActivation.click();
 
 
  await sleep(
    1500
  );
 
 
  console.log(
    '✅ Activation rapide ouverte'
  );
}
 
 
async function readAutomationDistributionP10(
  page
) {
  const inactiveHeading =
    page.getByRole(
      'heading',
      {
        name:
          /Campagnes inactives/i
      }
    );
 
 
  const activeHeading =
    page.getByRole(
      'heading',
      {
        name:
          /Campagnes actives/i
      }
    );
 
 
  await inactiveHeading.waitFor({
    state:
      'visible',
 
    timeout:
      30000
  });
 
 
  await activeHeading.waitFor({
    state:
      'visible',
 
    timeout:
      30000
  });
 
 
  const inactiveBox =
    await inactiveHeading.boundingBox();
 
 
  const activeBox =
    await activeHeading.boundingBox();
 
 
  if (
    !inactiveBox ||
    !activeBox
  ) {
    throw new Error(
      'Colonnes automations introuvables'
    );
  }
 
 
  const inactiveCenterX =
    inactiveBox.x +
    inactiveBox.width /
      2;
 
 
  const activeCenterX =
    activeBox.x +
    activeBox.width /
      2;
 
 
  const middleX =
    (
      inactiveCenterX +
      activeCenterX
    ) /
    2;
 
 
  const minY =
    Math.max(
      inactiveBox.y +
        inactiveBox.height,
 
      activeBox.y +
        activeBox.height
    );
 
 
  const raw =
    await page
      .locator(
        'a, button, span, p, div'
      )
      .evaluateAll(
        (
          nodes,
          data
        ) =>
          nodes
            .map(
              el => {
                const rect =
                  el.getBoundingClientRect();
 
 
                return {
 
                  text:
                    (
                      el.textContent ||
                      ''
                    )
                      .replace(
                        /\s+/g,
                        ' '
                      )
                      .trim(),
 
                  x:
                    rect.left +
                    rect.width /
                      2,
 
                  y:
                    rect.top +
                    rect.height /
                      2,
 
                  width:
                    rect.width,
 
                  height:
                    rect.height,
 
                  childCount:
                    el.children.length
                };
              }
            )
            .filter(
              item =>
                item.text &&
                item.y >
                  data.minY &&
                item.width >
                  0 &&
                item.height >
                  0
            ),
 
        {
          minY
        }
      );
 
 
  const leaves =
    raw.filter(
      item =>
        item.childCount ===
        0
    );
 
 
  const ignored =
    [
      'Campagnes inactives',
      'Campagnes actives',
      'Activation rapide',
      'Activer',
      'Désactiver',
      'Etat actuel',
      'État actuel',
      'Ressources',
      'Assistance',
      'Feedback',
      'Nouveautés',
      'Modification',
      'Activation en masse'
    ].map(
      normalizeCompareP10
    );
 
 
  const candidates =
    leaves.filter(
      item => {
        const text =
          normalizeCompareP10(
            item.text
          );
 
 
        if (
          !text
        ) {
          return false;
        }
 
 
        if (
          text.length <
            4 ||
          text.length >
            160
        ) {
          return false;
        }
 
 
        if (
          ignored.some(
            ignoredText =>
              text ===
              ignoredText
          )
        ) {
          return false;
        }
 
 
        return true;
      }
    );
 
 
  const active =
    [];
 
 
  const inactive =
    [];
 
 
  const seen =
    new Set();
 
 
  for (
    const item
    of candidates
  ) {
    let column;
 
 
    if (
      inactiveCenterX <
      activeCenterX
    ) {
      column =
        item.x <
        middleX
          ? 'inactive'
          : 'active';
 
    } else {
      column =
        item.x <
        middleX
          ? 'active'
          : 'inactive';
    }
 
 
    const normalized =
      normalizeCompareP10(
        item.text
      );
 
 
    const key =
      `${column}::${normalized}`;
 
 
    if (
      seen.has(
        key
      )
    ) {
      continue;
    }
 
 
    seen.add(
      key
    );
 
 
    if (
      column ===
      'active'
    ) {
      active.push(
        normalizeTextP10(
          item.text
        )
      );
 
    } else {
      inactive.push(
        normalizeTextP10(
          item.text
        )
      );
    }
  }
 
 
  return {
 
    active,
 
    inactive
  };
}
 
 
function classifyAutomationStatusP10(
  distribution
) {
  const {
    active,
    inactive
  } =
    distribution;
 
 
  const total =
    active.length +
    inactive.length;
 
 
  if (
    total ===
    0
  ) {
    return {
 
      status:
        'UNKNOWN',
 
      action:
        'MANUAL_CHECK',
 
      unexpectedInactive:
        []
    };
  }
 
 
  if (
    active.length ===
      0 &&
    inactive.length >
      0
  ) {
    return {
 
      status:
        'INACTIVE',
 
      action:
        'ACTIVATE_AUTOMATIONS',
 
      unexpectedInactive:
        []
    };
  }
 
 
  const allowed =
    ALLOWED_INACTIVE_CAMPAIGNS_P10.map(
      normalizeCompareP10
    );
 
 
  const unexpectedInactive =
    inactive.filter(
      name =>
        !allowed.includes(
          normalizeCompareP10(
            name
          )
        )
    );
 
 
  if (
    unexpectedInactive.length >
    0
  ) {
    return {
 
      status:
        'PARTIAL',
 
      action:
        'FIX_AUTOMATION_CONFIGURATION',
 
      unexpectedInactive
    };
  }
 
 
  return {
 
    status:
      'ACTIVE',
 
    action:
      'SEARCH_PUNCTUAL_CAMPAIGN',
 
    unexpectedInactive:
      []
  };
}
 
 
// ============================================================
// P10 — BIBLIOTHÈQUE 12 MOIS / 36 CAMPAGNES
// ============================================================
 
const P10_LIBRARY = {
 
  Janvier: [
 
    {
      id: 1,
      name: 'Le luxe du calme',
      angle: 'Voyager quand tout le monde est rentré chez soi',
      audience: 'Loisirs',
      whyNow: 'Janvier permet de valoriser une destination plus calme et une expérience moins contrainte par l’affluence.'
    },
 
    {
      id: 2,
      name: '48h pour décrocher',
      angle: 'Micro-break après la reprise',
      audience: 'Couples',
      whyNow: 'La reprise de janvier crée un angle naturel pour proposer une courte parenthèse à deux.'
    },
 
    {
      id: 3,
      name: "Commencer l'année ailleurs",
      angle: "Première escapade de l'année",
      audience: 'One-timers',
      whyNow: "Le début d’année est un bon moment pour donner aux clients venus une seule fois une première raison de revenir."
    }
 
  ],
 
 
  Février: [
 
    {
      id: 1,
      name: 'La basse saison a du bon',
      angle: 'Moins de monde, plus de disponibilité, destination plus authentique',
      audience: 'Repeaters',
      whyNow: 'Février permet de faire redécouvrir la destination hors affluence à des clients qui la connaissent déjà.'
    },
 
    {
      id: 2,
      name: "Changer d'air, pas de saison",
      angle: 'Break spontané de 1–2 nuits',
      audience: 'Clientèle nationale',
      whyNow: 'La proximité géographique réduit la friction pour déclencher un court séjour spontané en basse saison.'
    },
 
    {
      id: 3,
      name: 'La destination rien que pour vous',
      angle: 'Profiter de la destination hors affluence',
      audience: 'Couples',
      whyNow: 'La basse saison de février se prête à une prise de parole centrée sur une escapade à deux plus intime.'
    }
 
  ],
 
 
  Mars: [
 
    {
      id: 1,
      name: 'Le retour des week-ends',
      angle: 'Relancer le réflexe escapade',
      audience: 'Loisirs',
      whyNow: 'Le retour des beaux jours permet de réinstaller naturellement le réflexe du week-end.'
    },
 
    {
      id: 2,
      name: '48h suffisent',
      angle: 'Séjour court, facile à décider',
      audience: 'Clientèle nationale',
      whyNow: 'Mars permet de vendre un séjour court et accessible sans attendre les grandes vacances.'
    },
 
    {
      id: 3,
      name: 'Et si vous reveniez ?',
      angle: 'Redécouverte après plusieurs mois',
      audience: 'Repeaters',
      whyNow: 'Le changement de saison fournit une nouvelle raison de revenir à des clients déjà familiers de la destination.'
    }
 
  ],
 
 
  Avril: [
 
    {
      id: 1,
      name: 'Partir avant tout le monde',
      angle: 'Profiter de la destination avant la haute saison',
      audience: 'Loisirs',
      whyNow: 'Avril permet de valoriser la destination juste avant la montée de la haute saison.'
    },
 
    {
      id: 2,
      name: 'Un week-end sans programme',
      angle: 'Hôtel comme point de départ, spontanéité',
      audience: 'Couples',
      whyNow: 'Les week-ends de printemps se prêtent à une escapade spontanée centrée sur le temps passé à deux.'
    },
 
    {
      id: 3,
      name: 'La bonne excuse pour revenir',
      angle: "Nouveautés de l'hôtel ou destination",
      audience: 'Repeaters',
      whyNow: 'Le printemps permet de présenter la destination sous un angle renouvelé à des clients déjà venus.'
    }
 
  ],
 
 
  Mai: [
 
    {
      id: 1,
      name: 'Transformez 1 jour en 3',
      angle: 'Exploiter ponts/jours fériés',
      audience: 'Clientèle nationale',
      whyNow: 'Les ponts et jours fériés de mai réduisent fortement le nombre de jours à poser pour partir.'
    },
 
    {
      id: 2,
      name: "Posez un jour. On s'occupe du reste.",
      angle: 'Prolonger week-end',
      audience: 'Business',
      whyNow: 'Mai permet de convertir une clientèle business en séjour de loisir autour des nombreux week-ends prolongés.'
    },
 
    {
      id: 3,
      name: 'Le séjour qui ne mange pas vos vacances',
      angle: "Micro-vacances avant l'été",
      audience: 'Couples',
      whyNow: "Mai permet de vendre une courte coupure à deux avant les vacances d’été."
    }
 
  ],
 
 
  Juin: [
 
    {
      id: 1,
      name: "Les journées qui n'en finissent plus",
      angle: 'Longues soirées',
      audience: 'Loisirs',
      whyNow: 'Les journées les plus longues de l’année permettent de valoriser davantage le temps passé sur place.'
    },
 
    {
      id: 2,
      name: 'Après le travail, les vacances',
      angle: 'Bleisure / départ jeudi-vendredi',
      audience: 'Business',
      whyNow: 'Juin se prête à la transformation d’un déplacement ou d’une fin de semaine de travail en escapade.'
    },
 
    {
      id: 3,
      name: '24h de plus',
      angle: 'Ajouter une nuit',
      audience: 'Clients à forte valeur',
      whyNow: 'Avant la haute saison, les clients à forte valeur constituent une audience pertinente pour pousser un séjour légèrement plus long.'
    }
 
  ],
 
 
  Juillet: [
 
    {
      id: 1,
      name: 'À contre-courant',
      angle: 'Destination différemment en pleine saison',
      audience: 'Vient souvent dans la région/ville',
      whyNow: 'En pleine saison, l’intérêt est de proposer une lecture différente de la destination à ceux qui la connaissent déjà.'
    },
 
    {
      id: 2,
      name: 'Le week-end commence jeudi',
      angle: 'Allonger séjour',
      audience: 'Clientèle nationale',
      whyNow: 'Juillet facilite les départs anticipés et les séjours prolongés pour une clientèle proche géographiquement.'
    },
 
    {
      id: 3,
      name: 'Vous connaissez vraiment [destination] ?',
      angle: 'Redécouverte anciens',
      audience: 'Repeaters',
      whyNow: 'La saison estivale offre de nouveaux usages de la destination à proposer aux anciens clients.'
    }
 
  ],
 
 
  Août: [
 
    {
      id: 1,
      name: 'Pendant que tout le monde est ailleurs…',
      angle: 'Contre-saisonnalité / destination différente',
      audience: 'Clientèle nationale',
      whyNow: 'Août permet de jouer la contre-saisonnalité et de proposer une autre façon de profiter de la destination.'
    },
 
    {
      id: 2,
      name: 'Votre prochaine escapade commence après les vacances',
      angle: "Vendre septembre plutôt qu'août",
      audience: 'Loisirs',
      whyNow: 'Fin août est un bon moment éditorial pour transformer l’envie de prolonger l’été en escapade de septembre.'
    },
 
    {
      id: 3,
      name: 'Revenez, mais autrement',
      angle: 'Nouveau motif de séjour pour un ancien client',
      audience: 'Repeaters',
      whyNow: 'La fin de l’été offre un angle naturel pour donner aux anciens clients une nouvelle raison de revenir.'
    }
 
  ],
 
 
  Septembre: [
 
    {
      id: 1,
      name: 'Les vacances après les vacances',
      angle: 'Partir lorsque les autres reprennent',
      audience: 'Couples',
      whyNow: 'Septembre permet de valoriser une destination plus calme après le pic des vacances.'
    },
 
    {
      id: 2,
      name: "Prolongez un peu l'été",
      angle: 'Arrière-saison',
      audience: 'Loisirs',
      whyNow: 'L’arrière-saison permet de prolonger l’imaginaire des vacances sans attendre un prochain grand départ.'
    },
 
    {
      id: 3,
      name: 'La rentrée peut attendre 48h',
      angle: 'Micro-break',
      audience: 'Clientèle nationale',
      whyNow: 'La rentrée crée un besoin de coupure courte, particulièrement facile à activer auprès d’une clientèle nationale.'
    }
 
  ],
 
 
  Octobre: [
 
    {
      id: 1,
      name: 'Deux nuits pour couper',
      angle: "Break court avant fin d'année",
      audience: 'Couples',
      whyNow: 'Octobre offre une fenêtre naturelle pour une courte pause à deux avant la fin d’année.'
    },
 
    {
      id: 2,
      name: 'La saison des week-ends improvisés',
      angle: 'Spontanéité / proximité',
      audience: 'Clientèle nationale',
      whyNow: 'L’automne se prête aux décisions de dernière minute et aux escapades de proximité.'
    },
 
    {
      id: 3,
      name: 'Revenir pour une autre saison',
      angle: 'Montrer destination différemment',
      audience: 'Vient souvent dans la région/ville',
      whyNow: 'Le changement de saison permet de renouveler la perception d’une destination déjà connue.'
    }
 
  ],
 
 
  Novembre: [
 
    {
      id: 1,
      name: "Le mois qu'on oublie de réserver",
      angle: 'Novembre opportunité',
      audience: 'Loisirs',
      whyNow: 'Novembre est une période moins spontanément réservée et se prête donc à une campagne de stimulation dédiée.'
    },
 
    {
      id: 2,
      name: 'Avant que décembre ne commence',
      angle: 'Parenthèse avant fêtes',
      audience: 'Couples',
      whyNow: 'La période précédant les fêtes offre un angle de parenthèse à deux avant l’agitation de décembre.'
    },
 
    {
      id: 3,
      name: "Vous méritez mieux qu'un week-end à la maison",
      angle: 'Escapade spontanée',
      audience: 'Clientèle nationale',
      whyNow: 'Novembre permet de travailler une envie de rupture simple et accessible auprès d’une clientèle de proximité.'
    }
 
  ],
 
 
  Décembre: [
 
    {
      id: 1,
      name: 'Entre deux réveillons',
      angle: '26–30 décembre',
      audience: 'Couples + Loisirs',
      whyNow: 'La période entre Noël et le Nouvel An crée une fenêtre de séjour spécifique, adaptée aux escapades à deux ou de loisir.'
    },
 
    {
      id: 2,
      name: 'Janvier se réserve maintenant',
      angle: 'Décembre acquisition basse saison',
      audience: 'Repeaters',
      whyNow: 'Décembre permet d’anticiper la basse saison de janvier auprès de clients qui connaissent déjà l’établissement.'
    },
 
    {
      id: 3,
      name: 'Offrir un souvenir plutôt qu’un objet',
      angle: 'Séjour / expérience à offrir',
      audience: 'Clients à forte valeur',
      whyNow: 'La période des cadeaux permet de positionner le séjour comme une expérience à offrir plutôt qu’un objet.'
    }
 
  ]
 
};
 
 
// ============================================================
// P10 — RÈGLE ⭐
// ============================================================
 
function getP10StarRule(
  returningRate
) {
  return returningRate <
    7
    ? {
 
        active:
          true,
 
        audiences: [
          'Repeaters',
          'One-timers',
          'Vient souvent dans la région/ville'
        ]
 
      }
    : {
 
        active:
          false,
 
        audiences:
          []
 
      };
}
 
 
function getMonthlyRecommendationsP10(
  monthName,
  starRule
) {
  const campaigns =
    P10_LIBRARY[
      monthName
    ];
 
 
  if (
    !campaigns
  ) {
    throw new Error(
      `Aucune bibliothèque P10 pour ${monthName}.`
    );
  }
 
 
  return campaigns.map(
    campaign => ({
 
      ...campaign,
 
      audiences: [
        campaign.audience
      ],
 
      starred:
        starRule.active &&
        starRule.audiences.includes(
          campaign.audience
        )
 
    })
  );
}
 
 
function printRecommendationsP10(
  monthName,
  recommendations
) {
  console.log('');
  console.log(
    '============================================================'
  );
 
  console.log(
    `💡 OPPORTUNITÉS P10 — ${monthName.toUpperCase()}`
  );
 
  console.log(
    '============================================================'
  );
 
 
  for (
    const campaign
    of recommendations
  ) {
    console.log('');
 
    console.log(
      `${campaign.starred ? '⭐ ' : ''}${campaign.id}. ${campaign.name}`
    );
 
    console.log(
      `   Angle    : ${campaign.angle}`
    );
 
    console.log(
      `   Audience : ${campaign.audience}`
    );
 
    console.log(
      `   Pourquoi maintenant ? : ${campaign.whyNow}`
    );
 
 
    if (
      campaign.starred
    ) {
      console.log(
        '   ⭐ Suggestion NAVI : cette campagne est mise en avant car son audience répond directement à une faiblesse identifiée dans le diagnostic CRM de l’hôtel.'
      );
    }
  }
}
 
 
async function chooseCampaignP10(
  recommendations
) {
  while (
    true
  ) {
    const answer =
      await askQuestion(
        '\n👉 Choisis une campagne (1, 2 ou 3) : '
      );
 
 
    const selected =
      recommendations.find(
        campaign =>
          campaign.id ===
          Number(
            answer
          )
      );
 
 
    if (
      selected
    ) {
      return selected;
    }
 
 
    console.log(
      '❌ Choix invalide. Entre 1, 2 ou 3.'
    );
  }
}
 
 
// ============================================================
// P10 — CONSTRUCTION AUDIENCE
// ============================================================
 
async function buildP10Audience(
  page,
  audienceName,
  averageSpend
) {
  console.log('');
 
  console.log(
    `🧩 Construction audience : ${audienceName}`
  );
 
 
  switch (
    audienceName
  ) {
 
    case 'Repeaters':
 
      await addRepeatersFilter(
        page
      );
 
      return {
        filters: [
          {
            field:
              'Nombre de réservations total',
 
            operator:
              '>=',
 
            value:
              2
          }
        ]
      };
 
 
    case 'Clientèle nationale':
 
      await addNationalAudienceFilter(
        page
      );
 
      return {
        filters: [
          {
            field:
              'Pays du client',
 
            operator:
              'IN',
 
            value: [
              'France'
            ]
          }
        ]
      };
 
 
    case 'Loisirs':
 
      await addLeisureAudienceFilter(
        page
      );
 
      return {
        filters: [
          {
            field:
              'Raison de la visite',
 
            operator:
              'NOT IN',
 
            value: [
              'Pour un salon ou un séminaire',
              "Voyage d'affaires"
            ]
          }
        ]
      };
 
 
    case 'Couples':
 
      await addCoupleFilter(
        page
      );
 
      return {
        filters: [
          {
            group:
              'OR',
 
            conditions: [
 
              {
                field:
                  'Segment visiteur',
 
                operator:
                  'IN',
 
                value: [
                  'En couple'
                ]
              },
 
              {
                field:
                  'Raison de la visite',
 
                operator:
                  'IN',
 
                value: [
                  'Voyage de noces'
                ]
              }
 
            ]
          }
        ]
      };
 
 
    case 'Business':
 
      await addBusinessFilter(
        page
      );
 
      return {
        filters: [
          {
            field:
              'Raison de la visite',
 
            operator:
              'IN',
 
            value: [
              'Pour un salon ou un séminaire',
              "Voyage d'affaires"
            ]
          }
        ]
      };
 
 
    case 'One-timers':
 
      await addOneTimerFilter(
        page
      );
 
      return {
        filters: [
          {
            field:
              'Nombre de réservations total',
 
            operator:
              '=',
 
            value:
              1
          }
        ]
      };
 
 
    case 'Vient souvent dans la région/ville':
 
      await addFrequentDestinationFilter(
        page
      );
 
      return {
        filters: [
          {
            field:
              'Vient souvent dans la ville/région',
 
            operator:
              '=',
 
            value:
              'oui'
          }
        ]
      };
 
 
    case 'Clients à forte valeur':
 
      if (
        !Number.isFinite(
          averageSpend
        )
      ) {
        throw new Error(
          'Dépense moyenne par réservation manquante.'
        );
      }
 
 
      await addHighValueFilter(
        page,
        averageSpend
      );
 
 
      return {
 
        filters: [
          {
            field:
              'Montant de la réservation',
 
            operator:
              '>=',
 
            value:
              averageSpend
          }
        ],
 
        averageSpendPerBooking:
          averageSpend
      };
 
 
    case 'Couples + Loisirs':
 
      await addCouplesLeisureFilter(
        page
      );
 
      return {
        filters: [
          {
            group:
              'OR',
 
            conditions: [
 
              {
                field:
                  'Segment visiteur',
 
                operator:
                  'IN',
 
                value: [
                  'En couple'
                ]
              },
 
              {
                field:
                  'Raison de la visite',
 
                operator:
                  'NOT IN',
 
                value: [
                  'Pour un salon ou un séminaire',
                  "Voyage d'affaires"
                ]
              }
 
            ]
          }
        ]
      };
 
 
    default:
 
      throw new Error(
        `Audience P10 inconnue : ${audienceName}`
      );
  }
}
 
 
// ============================================================
// P10 — PLAYBOOK INTÉGRÉ
// ============================================================
 
async function runP10Playbook(
  page,
  scanResult,
  signal
) {
  console.log('');
  console.log(
    '============================================================'
  );
 
  console.log(
    '🎯 P10 — SOUS-ACTIVATION CRM'
  );
 
  console.log(
    '============================================================'
  );
 
 
  // ----------------------------------------------------------
  // RETURNING GUESTS
  //
  // On réutilise ici la donnée du scan NAVI.
  // Pas besoin de refaire le scraping Revenu.
  // ----------------------------------------------------------
 
  const returning =
    scanResult.returning;
 
 
  if (
    !returning ||
    !Number.isFinite(
      Number(
        returning.N
      )
    )
  ) {
    throw new Error(
      'Returning Guests indisponible pour P10.'
    );
  }
 
 
  console.log('');
  console.log(
    `🔁 Returning ${returning.yearN} : ${returning.N} %`
  );
 
  console.log(
    `   Returning ${returning.yearN1} : ${returning.N1} %`
  );
 
  console.log(
    `   Évolution : ${returning.evolution} pts`
  );
 
 
  // ----------------------------------------------------------
  // AUTOMATIONS
  // ----------------------------------------------------------
 
  await openAutomationStatusP10(
    page
  );
 
 
  const automationDistribution =
    await readAutomationDistributionP10(
      page
    );
 
 
  console.log('');
  console.log(
    '📊 Distribution automations :'
  );
 
  console.log(
    `   Actives   : ${automationDistribution.active.length}`
  );
 
  console.log(
    `   Inactives : ${automationDistribution.inactive.length}`
  );
 
 
  const automationStatus =
    classifyAutomationStatusP10(
      automationDistribution
    );
 
 
  console.log('');
  console.log(
    `📌 Statut P10 : ${automationStatus.status}`
  );
 
  console.log(
    `   Action : ${automationStatus.action}`
  );
 
 
  // ----------------------------------------------------------
  // RÈGLE ⭐
  // ----------------------------------------------------------
 
  const starRule =
    getP10StarRule(
      Number(
        returning.N
      )
    );
 
 
  console.log('');
  console.log(
    `⭐ Règle fidélisation : ${starRule.active ? 'ACTIVE' : 'NON ACTIVE'}`
  );
 
 
  if (
    starRule.active
  ) {
    console.log(
      `   Returning Guests = ${returning.N} % < 7 %`
    );
  }
 
 
  // ----------------------------------------------------------
  // SI LES AUTOMATIONS NE SONT PAS CORRECTEMENT ACTIVES :
  // STOP.
  // ----------------------------------------------------------
 
  if (
    automationStatus.action !==
    'SEARCH_PUNCTUAL_CAMPAIGN'
  ) {
    console.log('');
    console.log(
      '============================================================'
    );
 
    console.log(
      'DÉCISION NAVI P10'
    );
 
    console.log(
      '============================================================'
    );
 
 
    if (
      automationStatus.action ===
      'ACTIVATE_AUTOMATIONS'
    ) {
      console.log(
        '🛑 Le pack d’automations marketing n’est pas activé.'
      );
 
      console.log(
        '→ Recommandation NAVI : activer les automations marketing.'
      );
 
    } else if (
      automationStatus.action ===
      'FIX_AUTOMATION_CONFIGURATION'
    ) {
      console.log(
        '⚠️ Le pack d’automations est partiellement configuré.'
      );
 
      console.log(
        '→ Corriger les automations inattendues avant de proposer une campagne ponctuelle.'
      );
 
      console.log('');
      console.log(
        'Campagnes inactives inattendues :'
      );
 
 
      for (
        const campaign
        of automationStatus.unexpectedInactive
      ) {
        console.log(
          `   • ${campaign}`
        );
      }
 
    } else {
      console.log(
        '❓ Vérification manuelle nécessaire.'
      );
    }
 
 
    return {
 
      playbookId:
        'P10',
 
      executed:
        true,
 
      automationStatus,
 
      audience:
        null,
 
      stoppedBeforeCampaign:
        true
    };
  }
 
 
  // ----------------------------------------------------------
  // 3 RECOMMANDATIONS DU MOIS
  // ----------------------------------------------------------
 
  const monthName =
    MONTHS_FR[
      new Date()
        .getMonth()
    ];
 
 
  const recommendations =
    getMonthlyRecommendationsP10(
      monthName,
      starRule
    );
 
 
  printRecommendationsP10(
    monthName,
    recommendations
  );
 
 
  // ----------------------------------------------------------
  // L'utilisateur choisit d'abord sa campagne.
  //
  // AUCUNE audience n'est créée avant ce choix.
  // ----------------------------------------------------------
 
  const selectedCampaign =
    await chooseCampaignP10(
      recommendations
    );
 
 
  console.log('');
  console.log(
    '============================================================'
  );
 
  console.log(
    '🎯 CAMPAGNE SÉLECTIONNÉE'
  );
 
  console.log(
    '============================================================'
  );
 
  console.log(
    `${selectedCampaign.starred ? '⭐ ' : ''}${selectedCampaign.name}`
  );
 
  console.log(
    `Angle : ${selectedCampaign.angle}`
  );
 
  console.log(
    `Audience : ${selectedCampaign.audience}`
  );
 
  console.log(
    'Mécanique suggérée : avantage réservation directe + code fidélité'
  );
 
 
  // ----------------------------------------------------------
  // On demande ensuite si l'utilisateur veut mesurer
  // réellement l'audience.
  // ----------------------------------------------------------
 
  const shouldPreview =
    await askYesNo(
      '\nSouhaites-tu prévisualiser cette audience ?'
    );
 
 
  if (
    !shouldPreview
  ) {
    console.log(
      '⏭️ Audience non prévisualisée.'
    );
 
 
    return {
 
      playbookId:
        'P10',
 
      executed:
        true,
 
      month:
        monthName,
 
      returningGuests:
        returning,
 
      automations: {
 
        activeCount:
          automationDistribution.active.length,
 
        inactiveCount:
          automationDistribution.inactive.length,
 
        status:
          automationStatus.status,
 
        action:
          automationStatus.action,
 
        unexpectedInactive:
          automationStatus.unexpectedInactive
      },
 
      starRule,
 
      recommendations,
 
      selectedCampaign,
 
      audiencePreview:
        null
    };
  }
 
 
  // ----------------------------------------------------------
  // CLIENTS À FORTE VALEUR
  // ----------------------------------------------------------
 
  let averageSpend =
    null;
 
 
  if (
    selectedCampaign.audience ===
    'Clients à forte valeur'
  ) {
    averageSpend =
      await scrapeAverageSpendPerBooking(
        page
      );
 
 
    console.log(
      `📌 Seuil Clients à forte valeur : ${averageSpend} €`
    );
  }
 
 
  // ----------------------------------------------------------
  // AUDIENCE BUILDER
  // ----------------------------------------------------------
 
  await openMailingLists(
    page
  );
 
 
  await startNewAudience(
    page
  );
 
 
  const audienceDefinition =
    await buildP10Audience(
      page,
      selectedCampaign.audience,
      averageSpend
    );
 
 
  await recalculateResults(
    page
  );
 
 
  await selectNaviMode(
    page
  );
 
 
  const currentTempName =
    createTempName(
      'P10',
      scanResult.hotel,
      selectedCampaign.audience
    );
 
 
  await saveTemporaryAudience(
    page,
    currentTempName
  );
 
 
  await reopenTemporaryAudience(
    page,
    currentTempName
  );
 
 
  const recipients =
    await getNaviRecipientsCount(
      page
    );
 
 
  console.log('');
  console.log(
    '============================================================'
  );
 
  console.log(
    '✅ AUDIENCE P10 MESURÉE'
  );
 
  console.log(
    '============================================================'
  );
 
  console.log(
    `Campagne : ${selectedCampaign.name}`
  );
 
  console.log(
    `Audience : ${selectedCampaign.audience}`
  );
 
  console.log(
    `👥 Audience réelle : ${formatNumber(
      recipients
    )} destinataire(s)`
  );
 
 
  const deletedTempName =
    currentTempName;
 
 
  await deleteAudience(
    page,
    currentTempName
  );
 
 
  // ----------------------------------------------------------
  // CARTE FINALE
  // ----------------------------------------------------------
 
  console.log('');
  console.log(
    '============================================================'
  );
 
  console.log(
    'CARTE FINALE NAVI — P10'
  );
 
  console.log(
    '============================================================'
  );
 
  console.log(
    `${selectedCampaign.starred ? '⭐ ' : ''}${selectedCampaign.name}`
  );
 
  console.log(
    `Angle : ${selectedCampaign.angle}`
  );
 
  console.log(
    `Pourquoi maintenant ? : ${selectedCampaign.whyNow}`
  );
 
 
  if (
    selectedCampaign.starred
  ) {
    console.log(
      '⭐ Suggestion NAVI : cette campagne est mise en avant car son audience répond directement à une faiblesse identifiée dans le diagnostic CRM de l’hôtel.'
    );
  }
 
 
  console.log(
    `Audience : ${selectedCampaign.audience} — ${formatNumber(
      recipients
    )} destinataire(s)`
  );
 
  console.log(
    'Mécanique suggérée : avantage réservation directe + code fidélité'
  );
 
  console.log(
    'Statut audience : preview mesurée, liste temporaire supprimée'
  );
 
 
  return {
 
    playbookId:
      'P10',
 
    executed:
      true,
 
    month:
      monthName,
 
    returningGuests:
      returning,
 
    automations: {
 
      activeCount:
        automationDistribution.active.length,
 
      inactiveCount:
        automationDistribution.inactive.length,
 
      status:
        automationStatus.status,
 
      action:
        automationStatus.action,
 
      unexpectedInactive:
        automationStatus.unexpectedInactive
    },
 
    starRule,
 
    recommendations: {
 
      month:
        monthName,
 
      campaigns:
        recommendations
    },
 
    selectedCampaign: {
 
      id:
        selectedCampaign.id,
 
      name:
        selectedCampaign.name,
 
      angle:
        selectedCampaign.angle,
 
      whyNow:
        selectedCampaign.whyNow,
 
      audience:
        selectedCampaign.audience,
 
      starred:
        selectedCampaign.starred,
 
      mechanic:
        'avantage réservation directe + code fidélité'
    },
 
    audiencePreview: {
 
      ...audienceDefinition,
 
      recipientMode:
        'exclude_future_and_current_guests',
 
      recipients,
 
      tempName:
        deletedTempName,
 
      status:
        'deleted'
    }
  };
}
 
 
// ============================================================
// FIN BLOC 7/8
// ============================================================
// ============================================================
// NAVI — BLOC 8/8
// MOTEUR INTÉGRÉ FINAL
//
// DATA
//   ↓
// CRM HEALTH
//   ↓
// SIGNALS
//   ↓
// PLAYBOOKS
//   ↓
// AUDIENCE BUILDER
// ============================================================
 
 
// ============================================================
// ALIAS CATALOGUE PLAYBOOKS
//
// PLAYBOOKS a été déclaré UNE SEULE FOIS dans le bloc 1.
// Certaines fonctions du bloc 6 utilisent PLAYBOOK_CATALOG.
// ============================================================
 
const PLAYBOOK_CATALOG =
  PLAYBOOKS;
 
 
// ============================================================
// SCAN D'UN HÔTEL
// ============================================================
 
async function scanHotel(
  page,
  hotelName
) {
  console.log('');
  console.log(
    '============================================================'
  );
 
  console.log(
    `🏨 NAVI SCAN — ${hotelName}`
  );
 
  console.log(
    '============================================================'
  );
 
 
  await selectHotel(
    page,
    hotelName
  );
 
 
  // ==========================================================
  // 1. BASE EXPLOITABLE
  // ==========================================================
 
  console.log('');
  console.log(
    '📊 Base exploitable...'
  );
 
 
  await openCustomerAnalysis(
    page
  );
 
 
  await applyPeriodWithToggle(
    page,
    CONFIG.period
  );
 
 
  const base =
    await scrapeGeneralKPIs(
      page
    );
 
 
  console.log(
    `   Profils clients : ${formatNumber(
      base.totalProfiles
    )}`
  );
 
 
  console.log(
    `   E-mails utilisables : ${formatNumber(
      base.usableEmails
    )}`
  );
 
 
  console.log(
    `   Activabilité : ${round2(
      base.activabilityRate
    )} %`
  );
 
 
  // ==========================================================
  // 2. CAPTATION
  // ==========================================================
 
  console.log('');
  console.log(
    '📥 Captation e-mail...'
  );
 
 
  await openActivity(
    page
  );
 
 
  await applyPeriodWithToggle(
    page,
    CONFIG.period
  );
 
 
  const activity =
    await scrapeEmailCapture(
      page
    );
 
 
  console.log(
    `   Captation : ${round2(
      activity.displayedRate
    )} %`
  );
 
 
  console.log(
    `   E-mails captés : ${formatNumber(
      activity.capturedEmails
    )} / ${formatNumber(
      activity.captureBase
    )}`
  );
 
 
  // ==========================================================
  // 3. DÉPENDANCE OTA
  // ==========================================================
 
  console.log('');
  console.log(
    '💰 Dépendance OTA...'
  );
 
 
  await openRevenue(
    page
  );
 
 
  const ota =
    await scrapeRevenueOTAKPIs(
      page
    );
 
 
  console.log(
    `   Non OTA ${ota.yearN} : ${round2(
      ota.nonOta.reservationShare.N
    )} %`
  );
 
 
  console.log(
    `   Booking.com ${ota.yearN} : ${round2(
      ota.booking.reservationShare.N
    )} %`
  );
 
 
  console.log(
    `   Expedia ${ota.yearN} : ${round2(
      ota.expedia.reservationShare.N
    )} %`
  );
 
 
  // ==========================================================
  // 4. RETURNING GUESTS
  //
  // IMPORTANT :
  // on reste bien dans Revenu avant d'appeler le scraper.
  // ==========================================================
 
  console.log('');
  console.log(
    '🔁 Fidélisation...'
  );
 
 
  const returning =
    await scrapeReturningGuests(
      page
    );
 
 
  console.log(
    `   Returning ${returning.yearN} : ${round2(
      returning.N
    )} %`
  );
 
 
  console.log(
    `   Returning ${returning.yearN1} : ${round2(
      returning.N1
    )} %`
  );
 
 
  console.log(
    `   Évolution : ${round2(
      returning.evolution
    )} pts`
  );
 
 
  // ==========================================================
  // 5. ACTIVATION CRM
  // ==========================================================
 
  console.log('');
  console.log(
    '📣 Activation CRM...'
  );
 
 
  await openMarketingStats(
    page
  );
 
 
  await setMarketingPeriod(
    page,
    CONFIG.period
  );
 
 
  const marketing =
    await scrapeMarketingKPIs(
      page
    );
 
 
  const activationRate =
    calculateActivationRate(
      marketing.total.bookings,
      base.usableEmails
    );
 
 
  console.log(
    `   Réservations CRM : ${formatNumber(
      marketing.total.bookings
    )}`
  );
 
 
  console.log(
    `   Campagnes ponctuelles : ${formatNumber(
      marketing.campaigns.bookings
    )}`
  );
 
 
  console.log(
    `   Automations : ${formatNumber(
      marketing.automations.bookings
    )}`
  );
 
 
  console.log(
    `   Activation : ${round2(
      activationRate
    )} réservation(s) / 1 000 profils`
  );
 
 
  // ==========================================================
  // 6. CRM HEALTH
  // ==========================================================
 
  const health =
    calculateCRMHealth({
 
      activabilityRate:
        base.activabilityRate,
 
      captureRate:
        activity.displayedRate,
 
      nonOtaRate:
        ota
          .nonOta
          .reservationShare
          .N,
 
      returningRate:
        returning.N,
 
      activationRate
 
    });
 
 
  const healthLevel =
    getHealthLevel(
      health.totalScore
    );
 
 
  // ==========================================================
  // 7. SIGNAL ENGINE
  // ==========================================================
 
  const signalResult =
    detectSignals({
 
      activabilityRate:
        base.activabilityRate,
 
      captureRate:
        activity.displayedRate,
 
      nonOtaRate:
        ota
          .nonOta
          .reservationShare
          .N,
 
      returningRate:
        returning.N,
 
      returningEvolution:
        returning.evolution,
 
      activationRate,
 
      totalCrmBookings:
        marketing.total.bookings,
 
      automationBookings:
        marketing.automations.bookings
 
    });
 
 
  // ==========================================================
  // AFFICHAGE CRM HEALTH
  // ==========================================================
 
  console.log('');
  console.log(
    '============================================================'
  );
 
  console.log(
    '❤️ NAVI — CRM HEALTH'
  );
 
  console.log(
    '============================================================'
  );
 
 
  console.log(
    `Base exploitable : ${health.baseScore}/20`
  );
 
 
  console.log(
    `Captation        : ${health.captureScore}/15`
  );
 
 
  console.log(
    `OTA              : ${health.otaScore}/20`
  );
 
 
  console.log(
    `Fidélisation     : ${health.loyaltyScore}/20`
  );
 
 
  console.log(
    `Activation       : ${health.activationScore}/25`
  );
 
 
  console.log('');
  console.log(
    `❤️ CRM Health : ${health.totalScore}/100 — ${healthLevel}`
  );
 
 
  // ==========================================================
  // AFFICHAGE SIGNALS
  // ==========================================================
 
  console.log('');
  console.log(
    '============================================================'
  );
 
  console.log(
    '🚨 NAVI — SIGNALS'
  );
 
  console.log(
    '============================================================'
  );
 
 
  console.log(
    `${signalResult.signals.length} signal(s) détecté(s)`
  );
 
 
  if (
    signalResult.signals.length ===
      0
  ) {
    console.log('');
    console.log(
      '⚪ Aucun signal actionnable détecté.'
    );
 
  } else {
 
    for (
      const signal
      of signalResult.signals
    ) {
      console.log('');
 
      console.log(
        `• ${signal.id} — ${signal.name}`
      );
 
      console.log(
        `  ↳ ${signal.trigger}`
      );
    }
  }
 
 
  // ==========================================================
  // OBJET SCAN
  //
  // On conserve :
  // - les objets nested utiles aux modules NAVI
  // - les champs flat utiles aux exports CSV.
  // ==========================================================
 
  return {
 
    hotel:
      hotelName,
 
    status:
      'OK',
 
    period:
      PERIOD_PRESETS[
        CONFIG.period.value
      ],
 
 
    // --------------------------------------------------------
    // OBJETS SOURCE
    // --------------------------------------------------------
 
    base,
 
    activity,
 
    ota,
 
    returning,
 
    marketing,
 
    health,
 
 
    // --------------------------------------------------------
    // KPI FLAT
    // --------------------------------------------------------
 
    totalProfiles:
      base.totalProfiles,
 
    emailsProvided:
      base.emailsProvided,
 
    usableEmails:
      base.usableEmails,
 
    activabilityRate:
      round2(
        base.activabilityRate
      ),
 
 
    captureRate:
      round2(
        activity.displayedRate
      ),
 
    capturedEmails:
      activity.capturedEmails,
 
    captureBase:
      activity.captureBase,
 
 
    yearN:
      ota.yearN,
 
    yearN1:
      ota.yearN1,
 
 
    nonOtaN:
      ota
        .nonOta
        .reservationShare
        .N,
 
    nonOtaN1:
      ota
        .nonOta
        .reservationShare
        .N1,
 
 
    bookingN:
      ota
        .booking
        .reservationShare
        .N,
 
    expediaN:
      ota
        .expedia
        .reservationShare
        .N,
 
 
    returningN:
      returning.N,
 
    returningN1:
      returning.N1,
 
    returningEvolution:
      round2(
        returning.evolution
      ),
 
 
    crmRevenue:
      marketing
        .total
        .revenue,
 
    totalCrmBookings:
      marketing
        .total
        .bookings,
 
    campaignBookings:
      marketing
        .campaigns
        .bookings,
 
    automationBookings:
      marketing
        .automations
        .bookings,
 
 
    automationShare:
      signalResult
        .automationShare,
 
 
    activationRate:
      round2(
        activationRate
      ),
 
 
    // --------------------------------------------------------
    // CRM HEALTH
    // --------------------------------------------------------
 
    baseScore:
      health.baseScore,
 
    captureScore:
      health.captureScore,
 
    otaScore:
      health.otaScore,
 
    loyaltyScore:
      health.loyaltyScore,
 
    activationScore:
      health.activationScore,
 
    healthScore:
      health.totalScore,
 
    healthLevel,
 
 
    // --------------------------------------------------------
    // SIGNALS
    // --------------------------------------------------------
 
    signalCount:
      signalResult
        .signals
        .length,
 
    signals:
      signalResult.signals,
 
 
    // --------------------------------------------------------
    // PLAYBOOKS
    //
    // Rempli APRÈS le scan.
    // --------------------------------------------------------
 
    playbooks:
      []
 
  };
}
 
 
// ============================================================
// EXPORT JSON + CSV
// ============================================================
 
function saveResults(
  results
) {
 
  // ==========================================================
  // JSON
  // ==========================================================
 
  fs.writeFileSync(
    CONFIG.outputJson,
    JSON.stringify(
      results,
      null,
      2
    ),
    'utf8'
  );
 
 
  // ==========================================================
  // CSV
  // ==========================================================
 
  const headers = [
 
    'Hotel',
 
    'Statut',
 
    'Periode',
 
    'Total profils',
 
    'Emails utilisables',
 
    'Activabilite (%)',
 
    'Captation (%)',
 
    'Emails captes',
 
    'Base captation',
 
    'Annee N',
 
    'Non OTA N (%)',
 
    'Non OTA N-1 (%)',
 
    'Booking N (%)',
 
    'Expedia N (%)',
 
    'Returning N (%)',
 
    'Returning N-1 (%)',
 
    'Evolution Returning (pts)',
 
    'Reservations CRM',
 
    'Reservations campagnes',
 
    'Reservations automations',
 
    'Part automations (%)',
 
    'Activation CRM / 1000',
 
    'Score Base /20',
 
    'Score Captation /15',
 
    'Score OTA /20',
 
    'Score Fidelisation /20',
 
    'Score Activation /25',
 
    'CRM Health /100',
 
    'Niveau CRM Health',
 
    'Nombre de Signals',
 
    'Signals',
 
    'Declencheurs',
 
    'Playbooks',
 
    'Audiences mesurees',
 
    'Erreur'
 
  ];
 
 
  const lines = [
 
    headers
      .map(
        csvEscape
      )
      .join(
        ';'
      )
 
  ];
 
 
  for (
    const result
    of results
  ) {
 
    const signals =
      Array.isArray(
        result.signals
      )
        ? result.signals
        : [];
 
 
    const playbooks =
      Array.isArray(
        result.playbooks
      )
        ? result.playbooks
        : [];
 
 
    const playbookSummary =
      playbooks
        .map(
          playbook => {
 
            const id =
              playbook
                ?.playbookId ||
              'N/A';
 
 
            if (
              playbook
                ?.error
            ) {
              return (
                `${id}: ERREUR`
              );
            }
 
 
            if (
              playbook
                ?.executed ===
              false
            ) {
              return (
                `${id}: NON EXECUTE`
              );
            }
 
 
            return (
              `${id}: EXECUTE`
            );
          }
        )
        .join(
          ' | '
        );
 
 
    const audienceSummary =
      playbooks
        .flatMap(
          playbook => {
 
            const audiences =
              [];
 
 
            // ----------------------------------------------
            // Audience simple
            // ----------------------------------------------
 
            if (
              playbook
                ?.audience &&
              Number.isFinite(
                Number(
                  playbook
                    .audience
                    .recipients
                )
              )
            ) {
              audiences.push(
                `${
                  playbook
                    .audience
                    .name ||
                  playbook
                    .playbookId
                }: ${
                  playbook
                    .audience
                    .recipients
                }`
              );
            }
 
 
            // ----------------------------------------------
            // P10
            // ----------------------------------------------
 
            if (
              playbook
                ?.audiencePreview &&
              Number.isFinite(
                Number(
                  playbook
                    .audiencePreview
                    .recipients
                )
              )
            ) {
              audiences.push(
                `P10 ${
                  playbook
                    ?.selectedCampaign
                    ?.audience ||
                  ''
                }: ${
                  playbook
                    .audiencePreview
                    .recipients
                }`
              );
            }
 
 
            // ----------------------------------------------
            // P11
            // ----------------------------------------------
 
            if (
              Array.isArray(
                playbook
                  ?.ranking
              )
            ) {
              for (
                const opportunity
                of playbook.ranking
              ) {
                audiences.push(
                  `P11 ${opportunity.name}: ${opportunity.recipients}`
                );
              }
            }
 
 
            return audiences;
          }
        )
        .join(
          ' | '
        );
 
 
    const row = [
 
      result.hotel,
 
      result.status,
 
      result.period,
 
      result.totalProfiles,
 
      result.usableEmails,
 
      result.activabilityRate,
 
      result.captureRate,
 
      result.capturedEmails,
 
      result.captureBase,
 
      result.yearN,
 
      result.nonOtaN,
 
      result.nonOtaN1,
 
      result.bookingN,
 
      result.expediaN,
 
      result.returningN,
 
      result.returningN1,
 
      result.returningEvolution,
 
      result.totalCrmBookings,
 
      result.campaignBookings,
 
      result.automationBookings,
 
      result.automationShare,
 
      result.activationRate,
 
      result.baseScore,
 
      result.captureScore,
 
      result.otaScore,
 
      result.loyaltyScore,
 
      result.activationScore,
 
      result.healthScore,
 
      result.healthLevel,
 
      result.signalCount,
 
 
      signals
        .map(
          signal =>
            `${signal.id} — ${signal.name}`
        )
        .join(
          ' | '
        ),
 
 
      signals
        .map(
          signal =>
            `${signal.id}: ${signal.trigger}`
        )
        .join(
          ' | '
        ),
 
 
      playbookSummary,
 
      audienceSummary,
 
      result.error ||
        ''
 
    ];
 
 
    lines.push(
      row
        .map(
          csvEscape
        )
        .join(
          ';'
        )
    );
  }
 
 
  fs.writeFileSync(
    CONFIG.outputCsv,
 
    '\uFEFF' +
      lines.join(
        '\n'
      ),
 
    'utf8'
  );
}
 
 
// ============================================================
// RÉINITIALISATION APRÈS ÉCHEC
// ============================================================
 
async function resetAfterScanError(
  page
) {
  console.log(
    '♻️ Réinitialisation avant nouvelle tentative...'
  );
 
 
  try {
 
    await goToHotelList(
      page
    );
 
 
    await sleep(
      1200
    );
 
 
    return;
 
  } catch (
    error
  ) {
 
    console.log(
      '⚠️ Retour liste impossible, rechargement Experience...'
    );
 
  }
 
 
  await page.goto(
    'https://crm.experience-hotel.com/',
    {
      waitUntil:
        'domcontentloaded',
 
      timeout:
        60000
    }
  );
 
 
  await sleep(
    2000
  );
 
 
  await connectToExperience(
    page
  );
}
 
 
// ============================================================
// MAIN
// ============================================================
 
(async () => {
 
  const globalStart =
    Date.now();
 
 
  const results =
    [];
 
 
  const durations =
    [];
 
 
  const context =
    await chromium
      .launchPersistentContext(
        USER_DATA_DIR,
        {
 
          headless:
            false,
 
          viewport:
            null
 
        }
      );
 
 
  const page =
    context.pages()[0] ||
    await context.newPage();
 
 
  try {
 
    // ========================================================
    // SESSION
    // ========================================================
 
    await connectToExperience(
      page
    );
 
 
    // ========================================================
    // BOUCLE HÔTELS
    // ========================================================
 
    for (
      let index = 0;
      index <
      CONFIG.hotels.length;
      index++
    ) {
 
      const hotelName =
        CONFIG.hotels[
          index
        ];
 
 
      const hotelStart =
        Date.now();
 
 
      console.log('');
      console.log(
        '############################################################'
      );
 
 
      console.log(
        `📍 HÔTEL ${index + 1}/${CONFIG.hotels.length} — ${hotelName}`
      );
 
 
      console.log(
        '############################################################'
      );
 
 
      // ------------------------------------------------------
      // ETA AVANT LE SCAN
      // ------------------------------------------------------
 
      if (
        durations.length >
        0
      ) {
 
        const average =
          durations.reduce(
            (
              sum,
              duration
            ) =>
              sum +
              duration,
            0
          ) /
          durations.length;
 
 
        const remaining =
          CONFIG.hotels.length -
          index;
 
 
        console.log(
          `⏳ Temps restant estimé : ${formatDuration(
            average *
            remaining
          )}`
        );
      }
 
 
      // ======================================================
      // SCAN AVEC RETRY
      // ======================================================
 
      let scanResult =
        null;
 
 
      let lastError =
        null;
 
 
      let successfulAttempt =
        null;
 
 
      for (
        let attempt = 1;
        attempt <=
        CONFIG.maxRetries;
        attempt++
      ) {
 
        try {
 
          console.log('');
          console.log(
            `🔄 Tentative scan ${attempt}/${CONFIG.maxRetries}`
          );
 
 
          scanResult =
            await scanHotel(
              page,
              hotelName
            );
 
 
          successfulAttempt =
            attempt;
 
 
          scanResult.attempt =
            attempt;
 
 
          console.log('');
          console.log(
            `✅ Scan CRM terminé pour ${hotelName}`
          );
 
 
          break;
 
        } catch (
          error
        ) {
 
          lastError =
            error;
 
 
          console.error('');
          console.error(
            `❌ Échec ${hotelName} — tentative ${attempt}/${CONFIG.maxRetries}`
          );
 
 
          console.error(
            error.stack ||
            error.message ||
            error
          );
 
 
          if (
            attempt <
            CONFIG.maxRetries
          ) {
 
            await resetAfterScanError(
              page
            );
 
 
            await sleep(
              1500
            );
          }
        }
      }
 
 
      // ======================================================
      // ÉCHEC DÉFINITIF DU SCAN
      // ======================================================
 
      if (
        !scanResult
      ) {
 
        const errorResult = {
 
          hotel:
            hotelName,
 
          status:
            'ERREUR',
 
          period:
            PERIOD_PRESETS[
              CONFIG
                .period
                .value
            ],
 
          attempt:
            CONFIG.maxRetries,
 
          error:
            lastError
              ? (
                  lastError.message ||
                  String(
                    lastError
                  )
                )
              : 'Erreur inconnue',
 
          signals:
            [],
 
          signalCount:
            0,
 
          playbooks:
            []
 
        };
 
 
        results.push(
          errorResult
        );
 
 
        saveResults(
          results
        );
 
 
        const duration =
          Date.now() -
          hotelStart;
 
 
        durations.push(
          duration
        );
 
 
        console.log('');
        console.log(
          `⏱️ ${hotelName} abandonné après ${formatDuration(
            duration
          )}`
        );
 
 
        continue;
      }
 
 
      // ======================================================
      // PLAYBOOK ENGINE
      //
      // IMPORTANT :
      // les erreurs Audience Builder ne déclenchent PAS
      // un nouveau scan de l'hôtel.
      //
      // Le retry concerne uniquement Data / CRM Health / Signals.
      // ======================================================
 
      console.log('');
      console.log(
        '============================================================'
      );
 
      console.log(
        '🧭 PASSAGE AUX PLAYBOOKS'
      );
 
      console.log(
        '============================================================'
      );
 
 
      let playbookResults =
        [];
 
 
      try {
 
        playbookResults =
          await runDetectedPlaybooks(
            page,
            scanResult
          );
 
      } catch (
        playbookError
      ) {
 
        console.error('');
        console.error(
          '❌ Erreur générale Playbook Engine'
        );
 
 
        console.error(
          playbookError.stack ||
          playbookError.message ||
          playbookError
        );
 
 
        playbookResults = [
          {
 
            playbookId:
              'ENGINE',
 
            executed:
              false,
 
            error:
              playbookError.message ||
              String(
                playbookError
              )
 
          }
        ];
      }
 
 
      scanResult.playbooks =
        playbookResults;
 
 
      scanResult.playbookCount =
        playbookResults.length;
 
 
      scanResult.successfulAttempt =
        successfulAttempt;
 
 
      // ======================================================
      // SAUVEGARDE IMMÉDIATE
      // ======================================================
 
      results.push(
        scanResult
      );
 
 
      saveResults(
        results
      );
 
 
      // ======================================================
      // DURÉE / PROGRESSION
      // ======================================================
 
      const duration =
        Date.now() -
        hotelStart;
 
 
      durations.push(
        duration
      );
 
 
      const average =
        durations.reduce(
          (
            sum,
            item
          ) =>
            sum +
            item,
          0
        ) /
        durations.length;
 
 
      const remainingHotels =
        CONFIG.hotels.length -
        (
          index +
          1
        );
 
 
      console.log('');
      console.log(
        '============================================================'
      );
 
 
      console.log(
        `✅ ${hotelName} terminé en ${formatDuration(
          duration
        )}`
      );
 
 
      console.log(
        `📊 Progression : ${index + 1}/${CONFIG.hotels.length}`
      );
 
 
      if (
        remainingHotels >
        0
      ) {
 
        console.log(
          `⏳ Temps restant estimé : ${formatDuration(
            average *
            remainingHotels
          )}`
        );
      }
 
 
      console.log(
        '============================================================'
      );
    }
 
 
    // ========================================================
    // FIN DU PORTFOLIO
    // ========================================================
 
    saveResults(
      results
    );
 
 
    console.log('');
    console.log(
      '############################################################'
    );
 
 
    console.log(
      '🎉 NAVI — SCAN INTÉGRÉ TERMINÉ'
    );
 
 
    console.log(
      '############################################################'
    );
 
 
    console.log('');
    console.log(
      `⏱️ Durée totale : ${formatDuration(
        Date.now() -
        globalStart
      )}`
    );
 
 
    console.log(
      `📄 CSV : ${CONFIG.outputCsv}`
    );
 
 
    console.log(
      `📄 JSON : ${CONFIG.outputJson}`
    );
 
 
    // ========================================================
    // RÉSUMÉ FINAL
    // ========================================================
 
    console.log('');
    console.log(
      '============================================================'
    );
 
 
    console.log(
      '📊 RÉSUMÉ NAVI'
    );
 
 
    console.log(
      '============================================================'
    );
 
 
    for (
      const result
      of results
    ) {
 
      console.log('');
 
 
      if (
        result.status ===
        'OK'
      ) {
 
        console.log(
          `✅ ${result.hotel}`
        );
 
 
        console.log(
          `   ❤️ CRM Health : ${result.healthScore}/100 — ${result.healthLevel}`
        );
 
 
        console.log(
          `   🚨 Signals : ${result.signalCount}`
        );
 
 
        if (
          Array.isArray(
            result.signals
          ) &&
          result.signals.length >
            0
        ) {
 
          console.log(
            `   → ${result.signals
              .map(
                signal =>
                  signal.id
              )
              .join(
                ', '
              )}`
          );
        }
 
 
        console.log(
          `   🧭 Playbooks : ${result.playbookCount || 0}`
        );
 
 
        const measuredAudiences =
          (
            result.playbooks ||
            []
          )
            .flatMap(
              playbook => {
 
                const values =
                  [];
 
 
                if (
                  playbook
                    ?.audience &&
                  Number.isFinite(
                    Number(
                      playbook
                        .audience
                        .recipients
                    )
                  )
                ) {
                  values.push(
                    `${playbook.playbookId}: ${playbook.audience.recipients}`
                  );
                }
 
 
                if (
                  playbook
                    ?.audiencePreview &&
                  Number.isFinite(
                    Number(
                      playbook
                        .audiencePreview
                        .recipients
                    )
                  )
                ) {
                  values.push(
                    `P10: ${playbook.audiencePreview.recipients}`
                  );
                }
 
 
                if (
                  Array.isArray(
                    playbook
                      ?.ranking
                  )
                ) {
                  for (
                    const opportunity
                    of playbook.ranking
                  ) {
                    values.push(
                      `P11 ${opportunity.id}: ${opportunity.recipients}`
                    );
                  }
                }
 
 
                return values;
              }
            );
 
 
        if (
          measuredAudiences.length >
          0
        ) {
 
          console.log(
            `   👥 Audiences mesurées : ${measuredAudiences.join(
              ' | '
            )}`
          );
        }
 
 
      } else {
 
        console.log(
          `❌ ${result.hotel}`
        );
 
 
        console.log(
          `   ${result.error}`
        );
      }
    }
 
 
    console.log('');
    console.log(
      '============================================================'
    );
 
 
    console.log(
      '✅ DATA → CRM HEALTH → SIGNALS → PLAYBOOKS → AUDIENCE BUILDER'
    );
 
 
    console.log(
      '============================================================'
    );
 
 
  } finally {
 
    // ========================================================
    // IMPORTANT :
    // pas de context.close()
    // ========================================================
 
    console.log('');
    console.log(
      '👀 Le navigateur reste ouvert pour vérification.'
    );
 
 
    console.log(
      'Tu peux le fermer manuellement quand tu veux.'
    );
 
  }
 
})();
 
 
// ============================================================
// FIN BLOC 8/8
// ============================================================
