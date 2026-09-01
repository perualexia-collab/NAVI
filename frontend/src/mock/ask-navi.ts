export const suggestedQuestions = [
  "Clients inactifs depuis + de 12 mois",
  "Clients OTA à convertir en direct",
  "Segments sous-sollicités"
];

export const moreSuggestedQuestions = [
  "Quels sont les clients les plus rentables de l'hôtel Galileo ?",
  "Quels clients n'ont pas reçu d'e-mails depuis plus de 90 jours ?",
  "Quel est le potentiel de conversion des clients OTA en direct ?",
  "Quelles sont les offres les plus performantes pour réactiver les inactifs ?"
];

export const conversationHistory = [
  { title: "Segments de clients à réactiver", timestamp: "Aujourd'hui à 10:42" },
  { title: "Performance des campagnes été 2026", timestamp: "Hier à 14:21" },
  { title: "Clients OTA à convertir en direct", timestamp: "28 août 2026" },
  { title: "Évolution du taux d'opt-in", timestamp: "27 août 2026" }
];

export interface AudienceSegment {
  rank: number;
  name: string;
  priority: "Priorité haute" | "Priorité moyenne";
  description: string;
  concernedClients: number;
  potentialRevenue: number;
  averageBasket: number;
  reactivationRate: number;
}

/**
 * Réponse mockée — illustre le format attendu (segments structurés,
 * sources citées) sans provenir d'un vrai appel Ask NAVI / LLM Service.
 * Le vrai flux (Context Builder → LLM Service) est branché en Phase H.
 */
export const mockAnswer = {
  question: "Quels sont les segments de clients à réactiver en priorité sur l'hôtel Galileo ?",
  respondedAt: "Aujourd'hui à 10:42",
  intro: "Voici les segments de clients à réactiver en priorité pour l'hôtel Galileo, identifiés selon leur potentiel de réactivation et leur valeur pour votre établissement.",
  segments: [
    {
      rank: 1,
      name: "Clients inactifs à fort potentiel",
      priority: "Priorité haute",
      description: "Clients n'ayant pas séjourné depuis 12 à 24 mois, avec un panier moyen élevé et un bon historique de satisfaction.",
      concernedClients: 312,
      potentialRevenue: 48750,
      averageBasket: 412,
      reactivationRate: 21
    },
    {
      rank: 2,
      name: "Clients OTA récurrents",
      priority: "Priorité haute",
      description: "Clients ayant réservé au moins 2 fois via OTA et jamais en direct. Potentiel de conversion important.",
      concernedClients: 276,
      potentialRevenue: 36120,
      averageBasket: 298,
      reactivationRate: 18
    },
    {
      rank: 3,
      name: "Clients inactifs récents",
      priority: "Priorité moyenne",
      description: "Clients n'ayant pas séjourné depuis 6 à 12 mois, avec un bon niveau d'engagement (ouverture d'e-mails, clics).",
      concernedClients: 514,
      potentialRevenue: 22340,
      averageBasket: 276,
      reactivationRate: 14
    }
  ] satisfies AudienceSegment[],
  totalPotentialRevenue: 107210,
  sources: [
    { label: "Données CRM – Hôtel Galileo", detail: "Dernière extraction : 31 août 2026 à 08:42" },
    { label: "Historique des séjours", detail: "Période : 01/01/2020 – 31/08/2026" },
    { label: "Segmentation NAVI", detail: "Modèle v2.1 – Clients à réactiver" }
  ]
};
