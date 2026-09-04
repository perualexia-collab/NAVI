import { prisma } from "../../src/db/prisma.js";

export type AskNaviIntent =
  | { type: "hotel-health"; hotelId: string; hotelName: string }
  | { type: "hotel-history"; hotelId: string; hotelName: string }
  | { type: "portfolio-signals"; portfolioId: string; portfolioName: string }
  | { type: "portfolio-financials"; portfolioId: string; portfolioName: string }
  | { type: "top-opportunities" }
  | { type: "hotels-without-recent-scan" }
  // Contexte de repli — toujours un aperçu réel (getAllHotelsOverview),
  // jamais un contexte vide. Retour réel 2026-09-03 : "quels hôtels
  // n'ont pas encore été testés ?" ne correspondait à aucun mot-clé,
  // Ask NAVI n'avait alors RIEN à se mettre sous la dent.
  | { type: "org-overview" };

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const HISTORY_KEYWORDS = ["historique", "evolution", "evolue", "evoluer", "tendance", "progression"];
const OPPORTUNITY_KEYWORDS = ["opportunite", "opportunites", "potentiel", "convertir", "a saisir"];
// "teste/testes" ajoutés (retour réel 2026-09-03) — synonyme courant de
// "scanné" dans le langage naturel, distinct du sens technique de
// "Tester la connexion" (Paramètres) qui n'a pas d'équivalent Context
// Builder dédié pour l'instant.
const WITHOUT_SCAN_KEYWORDS = [
  "pas scanne",
  "a scanner",
  "oublie",
  "jamais scanne",
  "dernier scan",
  "non scanne",
  "pas teste",
  "jamais teste",
  "non testes",
  "pas encore teste"
];
const FINANCIAL_KEYWORDS = [
  "ca crm",
  "chiffre d'affaires",
  "chiffre daffaires",
  "revenu",
  "revenus",
  "reservation",
  "reservations",
  // "résa" (normalisé sans accent) — abrégé courant, retour réel
  // 2026-09-04 : absent, une relance du type "quel hôtel a le plus de
  // résa ?" tombait sur portfolio-signals au lieu de portfolio-financials.
  "resa",
  "resas",
  "booking",
  "bookings"
];

function containsAny(normalizedQuestion: string, keywords: string[]): boolean {
  return keywords.some((keyword) => normalizedQuestion.includes(keyword));
}

function findBestMatch<T extends { name: string }>(entities: T[], normalizedSearchText: string): T | undefined {
  return entities
    .filter((entity) => entity.name.length >= 3 && normalizedSearchText.includes(normalize(entity.name)))
    .sort((a, b) => b.name.length - a.name.length)[0];
}

/**
 * Routeur d'intention (§09 Architecture Proposal) — mots-clés + entités
 * reconnues (nom d'hôtel, nom de portefeuille), jamais un second appel
 * LLM pour "décider quoi chercher". Choisit parmi le jeu fermé de
 * fonctions du Context Builder ; ne construit aucun prompt, ne parle à
 * aucun LLM.
 *
 * `recentHistoryText` (retour réel 2026-09-03 — mémoire conversationnelle) :
 * texte des QUESTIONS précédentes uniquement (jamais les réponses —
 * retour réel 2026-09-04 : une réponse sur un portefeuille cite souvent
 * des noms d'hôtels précis à titre d'exemple, ce qui faisait dévier une
 * relance générique vers un hôtel jamais réellement demandé). Utilisé
 * UNIQUEMENT en repli si la question seule ne nomme aucun hôtel/
 * portefeuille — pour qu'une relance elliptique ("détaille les actions")
 * reste rattachée à l'hôtel/portefeuille dont on parlait vraiment, sans
 * qu'une nouvelle question qui en nomme un autre explicitement ne se
 * fasse jamais "voler" par un historique périmé (la question courante
 * l'emporte toujours).
 *
 * Reconnaissance d'entité volontairement simple (sous-chaîne, la
 * correspondance la plus longue gagne) — un vrai NLU serait
 * disproportionné pour un premier jeu de questions ; se durcira avec
 * l'usage réel plutôt que d'être deviné à l'avance.
 */
export async function routeIntent(question: string, userId: string, recentHistoryText?: string): Promise<AskNaviIntent> {
  const normalizedQuestion = normalize(question);
  const normalizedWithHistory = recentHistoryText ? `${normalizedQuestion} ${normalize(recentHistoryText)}` : normalizedQuestion;

  const hotels = await prisma.hotel.findMany({ select: { id: true, name: true } });
  const matchedHotel = findBestMatch(hotels, normalizedQuestion) ?? findBestMatch(hotels, normalizedWithHistory);

  if (matchedHotel) {
    return containsAny(normalizedQuestion, HISTORY_KEYWORDS)
      ? { type: "hotel-history", hotelId: matchedHotel.id, hotelName: matchedHotel.name }
      : { type: "hotel-health", hotelId: matchedHotel.id, hotelName: matchedHotel.name };
  }

  const portfolios = await prisma.portfolio.findMany({ where: { ownerId: userId }, select: { id: true, name: true } });
  const matchedPortfolio = findBestMatch(portfolios, normalizedQuestion) ?? findBestMatch(portfolios, normalizedWithHistory);

  if (matchedPortfolio) {
    return containsAny(normalizedQuestion, FINANCIAL_KEYWORDS)
      ? { type: "portfolio-financials", portfolioId: matchedPortfolio.id, portfolioName: matchedPortfolio.name }
      : { type: "portfolio-signals", portfolioId: matchedPortfolio.id, portfolioName: matchedPortfolio.name };
  }

  if (containsAny(normalizedQuestion, OPPORTUNITY_KEYWORDS)) return { type: "top-opportunities" };
  if (containsAny(normalizedQuestion, WITHOUT_SCAN_KEYWORDS)) return { type: "hotels-without-recent-scan" };

  return { type: "org-overview" };
}
