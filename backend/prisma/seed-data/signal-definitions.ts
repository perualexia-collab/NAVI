/**
 * Catalogue des 12 signaux — transcrit depuis l'onglet "Signals & Playbook"
 * du référentiel Excel. Les identifiants P01…P12 restent strictement
 * internes (brief §5) ; audienceMode encode le modèle d'audience hybride
 * validé (SINGLE = "Calculer l'audience", MULTIPLE = "Comparer les
 * audiences/opportunités").
 */
export interface SignalDefinitionSeed {
  playbookId: string;
  name: string;
  severity: "ALERT" | "VIGILANCE" | "OPPORTUNITY";
  conditionDescription: string;
  recommendedAction: string;
  audienceMode: "NONE" | "SINGLE" | "MULTIPLE";
}

export const signalDefinitions: SignalDefinitionSeed[] = [
  {
    playbookId: "P01",
    name: "Captation insuffisante",
    severity: "ALERT",
    conditionDescription: "Taux de captation e-mail < 60 %",
    recommendedAction:
      "Faire un point avec les équipes opérationnelles, rappeler le process de captation et l'importance de récupérer l'e-mail, notamment pour les clients OTA. Suivre ensuite l'évolution de la captation.",
    audienceMode: "NONE"
  },
  {
    playbookId: "P02",
    name: "Collecte CRM critique",
    severity: "ALERT",
    conditionDescription: "Captation < 60 % ET Activabilité < 30 %",
    recommendedAction:
      "Opérations : remobiliser les équipes sur la captation. CRM : lancer une action préventive de réengagement pour éviter de perdre davantage de profils activables.",
    audienceMode: "SINGLE"
  },
  {
    playbookId: "P03",
    name: "Déperdition après collecte",
    severity: "ALERT",
    conditionDescription: "Captation ≥ 70 % ET Activabilité < 50 %",
    recommendedAction:
      "La captation est bonne : priorité au réengagement des profils qui commencent à décrocher avant qu'ils atteignent la règle d'inactivité à 18 mois. Campagne dédiée de réengagement.",
    audienceMode: "SINGLE"
  },
  {
    playbookId: "P04",
    name: "Base activable insuffisante",
    severity: "ALERT",
    conditionDescription: "Activabilité < 30 %, si aucun signal croisé plus précis ne s'applique",
    recommendedAction:
      "Opérations : remobiliser les équipes sur la captation. CRM : lancer une action préventive de réengagement pour éviter de perdre davantage de profils activables.",
    audienceMode: "SINGLE"
  },
  {
    playbookId: "P05",
    name: "Forte dépendance aux OTA",
    severity: "ALERT",
    conditionDescription: "Part des réservations Non OTA ≤ 20 %",
    recommendedAction: "Déclencher la stratégie Low Perf pour pousser la réservation directe.",
    audienceMode: "NONE"
  },
  {
    playbookId: "P06",
    name: "Potentiel OTA → Direct",
    severity: "OPPORTUNITY",
    conditionDescription: "Non OTA ≤ 30 % ET Returning Guests ≥ 7 %",
    recommendedAction:
      "Campagne spécifique mettant en avant le code fidélité, le gap tarifaire OTA/direct et les bénéfices de la réservation directe.",
    audienceMode: "SINGLE"
  },
  {
    playbookId: "P07",
    name: "Faible fidélisation",
    severity: "ALERT",
    conditionDescription: "Returning Guests < 5 %",
    recommendedAction:
      "L'hôtel a peu de repeaters : travailler largement les clients venus une seule fois avec une vraie raison de revenir (code fidélité, offre/avantage, wording adapté).",
    audienceMode: "SINGLE"
  },
  {
    playbookId: "P08",
    name: "Fidélisation en recul",
    severity: "VIGILANCE",
    conditionDescription: "Évolution Returning Guests ≤ −2 pts vs N-1",
    recommendedAction:
      "NAVI contextualise la baisse avec les autres KPI/signaux avant de recommander quoi que ce soit — pas de campagne uniquement parce que Returning Guests baisse de 2 pts.",
    audienceMode: "NONE"
  },
  {
    playbookId: "P09",
    name: "Potentiel de fidélisation inexploité",
    severity: "OPPORTUNITY",
    conditionDescription: "Returning Guests < 7 % ET Activabilité ≥ 50 % ET Activation CRM ≥ 18 ‰",
    recommendedAction:
      "Le CRM fonctionne déjà : exploiter cette capacité d'activation pour travailler une cible à plus fort potentiel (code fidélité, raison personnalisée de revenir).",
    audienceMode: "SINGLE"
  },
  {
    playbookId: "P10",
    name: "Sous-activation CRM",
    severity: "ALERT",
    conditionDescription: "Activation CRM < 8 réservations / 1 000 profils activables",
    recommendedAction:
      "Vérifier que les automations prévues sont actives ; si oui, identifier une campagne pertinente selon la période de l'année, hors calendrier existant et sans doublon avec les automations.",
    audienceMode: "MULTIPLE"
  },
  {
    playbookId: "P11",
    name: "Base CRM sous-exploitée",
    severity: "OPPORTUNITY",
    conditionDescription: "Activabilité ≥ 50 % ET Activation CRM < 8 ‰",
    recommendedAction:
      "Rechercher plusieurs segments exploitables dans la base, estimer leur taille et proposer les plus intéressants.",
    audienceMode: "MULTIPLE"
  },
  {
    playbookId: "P12",
    name: "Business CRM concentré sur les automations",
    severity: "VIGILANCE",
    conditionDescription: "Part des réservations CRM via automations ≥ 80 % ET réservations CRM totales ≥ 10",
    recommendedAction:
      "Pas de correction automatique — regarder simplement s'il existe une opportunité pertinente de campagne ponctuelle complémentaire.",
    audienceMode: "NONE"
  }
];
