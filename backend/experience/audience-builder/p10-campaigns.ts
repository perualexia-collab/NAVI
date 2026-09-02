/**
 * P10 — bibliothèque de 36 campagnes (3 par mois), règle ⭐ et
 * recommandations mensuelles. Porté à l'identique depuis
 * docs/reference/moteur-experience-existant.js (bloc 6/8 :
 * `P10_LIBRARY`, `getP10StarRule`, `getMonthlyRecommendationsP10`) — le
 * texte des campagnes (name/angle/whyNow) n'est pas un contenu à
 * réinventer, c'est le référentiel validé tel quel.
 *
 * Chaque campagne référence une `audience` (tag libre, ex. "Loisirs",
 * "Couples") — `AUDIENCE_TAG_TO_DEFINITION_ID` fait le lien vers le
 * catalogue `AudienceDefinition` en base (backend/prisma/seed-data/audience-definitions.ts),
 * pour rester sur le même modèle que les audiences E2/E3.
 */

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export function currentMonthNameFR(): string {
  return MONTHS_FR[new Date().getMonth()]!;
}

export interface P10CampaignTemplate {
  id: number;
  name: string;
  angle: string;
  audience: string;
  whyNow: string;
}

export const P10_LIBRARY: Record<string, P10CampaignTemplate[]> = {
  Janvier: [
    { id: 1, name: "Le luxe du calme", angle: "Voyager quand tout le monde est rentré chez soi", audience: "Loisirs", whyNow: "Janvier permet de valoriser une destination plus calme et une expérience moins contrainte par l'affluence." },
    { id: 2, name: "48h pour décrocher", angle: "Micro-break après la reprise", audience: "Couples", whyNow: "La reprise de janvier crée un angle naturel pour proposer une courte parenthèse à deux." },
    { id: 3, name: "Commencer l'année ailleurs", angle: "Première escapade de l'année", audience: "One-timers", whyNow: "Le début d'année est un bon moment pour donner aux clients venus une seule fois une première raison de revenir." }
  ],
  Février: [
    { id: 1, name: "La basse saison a du bon", angle: "Moins de monde, plus de disponibilité, destination plus authentique", audience: "Repeaters", whyNow: "Février permet de faire redécouvrir la destination hors affluence à des clients qui la connaissent déjà." },
    { id: 2, name: "Changer d'air, pas de saison", angle: "Break spontané de 1–2 nuits", audience: "Clientèle nationale", whyNow: "La proximité géographique réduit la friction pour déclencher un court séjour spontané en basse saison." },
    { id: 3, name: "La destination rien que pour vous", angle: "Profiter de la destination hors affluence", audience: "Couples", whyNow: "La basse saison de février se prête à une prise de parole centrée sur une escapade à deux plus intime." }
  ],
  Mars: [
    { id: 1, name: "Le retour des week-ends", angle: "Relancer le réflexe escapade", audience: "Loisirs", whyNow: "Le retour des beaux jours permet de réinstaller naturellement le réflexe du week-end." },
    { id: 2, name: "48h suffisent", angle: "Séjour court, facile à décider", audience: "Clientèle nationale", whyNow: "Mars permet de vendre un séjour court et accessible sans attendre les grandes vacances." },
    { id: 3, name: "Et si vous reveniez ?", angle: "Redécouverte après plusieurs mois", audience: "Repeaters", whyNow: "Le changement de saison fournit une nouvelle raison de revenir à des clients déjà familiers de la destination." }
  ],
  Avril: [
    { id: 1, name: "Partir avant tout le monde", angle: "Profiter de la destination avant la haute saison", audience: "Loisirs", whyNow: "Avril permet de valoriser la destination juste avant la montée de la haute saison." },
    { id: 2, name: "Un week-end sans programme", angle: "Hôtel comme point de départ, spontanéité", audience: "Couples", whyNow: "Les week-ends de printemps se prêtent à une escapade spontanée centrée sur le temps passé à deux." },
    { id: 3, name: "La bonne excuse pour revenir", angle: "Nouveautés de l'hôtel ou destination", audience: "Repeaters", whyNow: "Le printemps permet de présenter la destination sous un angle renouvelé à des clients déjà venus." }
  ],
  Mai: [
    { id: 1, name: "Transformez 1 jour en 3", angle: "Exploiter ponts/jours fériés", audience: "Clientèle nationale", whyNow: "Les ponts et jours fériés de mai réduisent fortement le nombre de jours à poser pour partir." },
    { id: 2, name: "Posez un jour. On s'occupe du reste.", angle: "Prolonger week-end", audience: "Business", whyNow: "Mai permet de convertir une clientèle business en séjour de loisir autour des nombreux week-ends prolongés." },
    { id: 3, name: "Le séjour qui ne mange pas vos vacances", angle: "Micro-vacances avant l'été", audience: "Couples", whyNow: "Mai permet de vendre une courte coupure à deux avant les vacances d'été." }
  ],
  Juin: [
    { id: 1, name: "Les journées qui n'en finissent plus", angle: "Longues soirées", audience: "Loisirs", whyNow: "Les journées les plus longues de l'année permettent de valoriser davantage le temps passé sur place." },
    { id: 2, name: "Après le travail, les vacances", angle: "Bleisure / départ jeudi-vendredi", audience: "Business", whyNow: "Juin se prête à la transformation d'un déplacement ou d'une fin de semaine de travail en escapade." },
    { id: 3, name: "24h de plus", angle: "Ajouter une nuit", audience: "Clients à forte valeur", whyNow: "Avant la haute saison, les clients à forte valeur constituent une audience pertinente pour pousser un séjour légèrement plus long." }
  ],
  Juillet: [
    { id: 1, name: "À contre-courant", angle: "Destination différemment en pleine saison", audience: "Vient souvent dans la région/ville", whyNow: "En pleine saison, l'intérêt est de proposer une lecture différente de la destination à ceux qui la connaissent déjà." },
    { id: 2, name: "Le week-end commence jeudi", angle: "Allonger séjour", audience: "Clientèle nationale", whyNow: "Juillet facilite les départs anticipés et les séjours prolongés pour une clientèle proche géographiquement." },
    { id: 3, name: "Vous connaissez vraiment [destination] ?", angle: "Redécouverte anciens", audience: "Repeaters", whyNow: "La saison estivale offre de nouveaux usages de la destination à proposer aux anciens clients." }
  ],
  Août: [
    { id: 1, name: "Pendant que tout le monde est ailleurs…", angle: "Contre-saisonnalité / destination différente", audience: "Clientèle nationale", whyNow: "Août permet de jouer la contre-saisonnalité et de proposer une autre façon de profiter de la destination." },
    { id: 2, name: "Votre prochaine escapade commence après les vacances", angle: "Vendre septembre plutôt qu'août", audience: "Loisirs", whyNow: "Fin août est un bon moment éditorial pour transformer l'envie de prolonger l'été en escapade de septembre." },
    { id: 3, name: "Revenez, mais autrement", angle: "Nouveau motif de séjour pour un ancien client", audience: "Repeaters", whyNow: "La fin de l'été offre un angle naturel pour donner aux anciens clients une nouvelle raison de revenir." }
  ],
  Septembre: [
    { id: 1, name: "Les vacances après les vacances", angle: "Partir lorsque les autres reprennent", audience: "Couples", whyNow: "Septembre permet de valoriser une destination plus calme après le pic des vacances." },
    { id: 2, name: "Prolongez un peu l'été", angle: "Arrière-saison", audience: "Loisirs", whyNow: "L'arrière-saison permet de prolonger l'imaginaire des vacances sans attendre un prochain grand départ." },
    { id: 3, name: "La rentrée peut attendre 48h", angle: "Micro-break", audience: "Clientèle nationale", whyNow: "La rentrée crée un besoin de coupure courte, particulièrement facile à activer auprès d'une clientèle nationale." }
  ],
  Octobre: [
    { id: 1, name: "Deux nuits pour couper", angle: "Break court avant fin d'année", audience: "Couples", whyNow: "Octobre offre une fenêtre naturelle pour une courte pause à deux avant la fin d'année." },
    { id: 2, name: "La saison des week-ends improvisés", angle: "Spontanéité / proximité", audience: "Clientèle nationale", whyNow: "L'automne se prête aux décisions de dernière minute et aux escapades de proximité." },
    { id: 3, name: "Revenir pour une autre saison", angle: "Montrer destination différemment", audience: "Vient souvent dans la région/ville", whyNow: "Le changement de saison permet de renouveler la perception d'une destination déjà connue." }
  ],
  Novembre: [
    { id: 1, name: "Le mois qu'on oublie de réserver", angle: "Novembre opportunité", audience: "Loisirs", whyNow: "Novembre est une période moins spontanément réservée et se prête donc à une campagne de stimulation dédiée." },
    { id: 2, name: "Avant que décembre ne commence", angle: "Parenthèse avant fêtes", audience: "Couples", whyNow: "La période précédant les fêtes offre un angle de parenthèse à deux avant l'agitation de décembre." },
    { id: 3, name: "Vous méritez mieux qu'un week-end à la maison", angle: "Escapade spontanée", audience: "Clientèle nationale", whyNow: "Novembre permet de travailler une envie de rupture simple et accessible auprès d'une clientèle de proximité." }
  ],
  Décembre: [
    { id: 1, name: "Entre deux réveillons", angle: "26–30 décembre", audience: "Couples + Loisirs", whyNow: "La période entre Noël et le Nouvel An crée une fenêtre de séjour spécifique, adaptée aux escapades à deux ou de loisir." },
    { id: 2, name: "Janvier se réserve maintenant", angle: "Décembre acquisition basse saison", audience: "Repeaters", whyNow: "Décembre permet d'anticiper la basse saison de janvier auprès de clients qui connaissent déjà l'établissement." },
    { id: 3, name: "Offrir un souvenir plutôt qu'un objet", angle: "Séjour / expérience à offrir", audience: "Clients à forte valeur", whyNow: "La période des cadeaux permet de positionner le séjour comme une expérience à offrir plutôt qu'un objet." }
  ]
};

/** Tag d'audience (texte libre du référentiel) → id AudienceDefinition en base. */
export const AUDIENCE_TAG_TO_DEFINITION_ID: Record<string, string> = {
  Repeaters: "P10_REPEATERS",
  "Clientèle nationale": "P10_NATIONAL",
  Loisirs: "P10_LEISURE",
  Couples: "P10_COUPLES",
  Business: "P10_BUSINESS",
  "One-timers": "P10_ONETIMER",
  "Vient souvent dans la région/ville": "P10_FREQUENT_DESTINATION",
  "Clients à forte valeur": "P10_HIGH_VALUE",
  "Couples + Loisirs": "P10_COUPLES_LEISURE"
};

export interface P10StarRule {
  active: boolean;
  audiences: string[];
}

/** Returning Guests < 7 % → met en avant les audiences de fidélisation (brief validé, cf. moteur existant). */
export function getP10StarRule(returningRate: number): P10StarRule {
  return returningRate < 7 ? { active: true, audiences: ["Repeaters", "One-timers", "Vient souvent dans la région/ville"] } : { active: false, audiences: [] };
}

export interface P10CampaignRecommendation extends P10CampaignTemplate {
  audienceDefinitionId: string;
  starred: boolean;
}

export function getMonthlyRecommendationsP10(monthName: string, starRule: P10StarRule): P10CampaignRecommendation[] {
  const campaigns = P10_LIBRARY[monthName];
  if (!campaigns) throw new Error(`Aucune bibliothèque P10 pour ${monthName}.`);

  return campaigns.map((campaign) => {
    const audienceDefinitionId = AUDIENCE_TAG_TO_DEFINITION_ID[campaign.audience];
    if (!audienceDefinitionId) throw new Error(`Audience P10 sans définition associée : ${campaign.audience}`);
    return { ...campaign, audienceDefinitionId, starred: starRule.active && starRule.audiences.includes(campaign.audience) };
  });
}
