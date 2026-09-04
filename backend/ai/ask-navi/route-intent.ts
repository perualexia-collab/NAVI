import { prisma } from "../../src/db/prisma.js";

export type AskNaviIntent =
  | { type: "hotel-health"; hotelId: string; hotelName: string }
  | { type: "hotel-history"; hotelId: string; hotelName: string }
  | { type: "portfolio-signals"; portfolioId: string; portfolioName: string }
  | { type: "top-opportunities" }
  | { type: "hotels-without-recent-scan" }
  | { type: "unknown" };

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const HISTORY_KEYWORDS = ["historique", "evolution", "evolue", "evoluer", "tendance", "progression"];
const OPPORTUNITY_KEYWORDS = ["opportunite", "opportunites", "potentiel", "convertir", "a saisir"];
const WITHOUT_SCAN_KEYWORDS = ["pas scanne", "a scanner", "oublie", "jamais scanne", "dernier scan", "non scanne"];
const SIGNAL_KEYWORDS = ["alerte", "vigilance", "signal", "signaux", "surveiller", "attention"];

function containsAny(normalizedQuestion: string, keywords: string[]): boolean {
  return keywords.some((keyword) => normalizedQuestion.includes(keyword));
}

/**
 * Routeur d'intention (§09 Architecture Proposal) — mots-clés + entités
 * reconnues (nom d'hôtel, nom de portefeuille), jamais un second appel
 * LLM pour "décider quoi chercher". Choisit parmi le jeu fermé de
 * fonctions du Context Builder ; ne construit aucun prompt, ne parle à
 * aucun LLM.
 *
 * Reconnaissance d'entité volontairement simple (sous-chaîne, la
 * correspondance la plus longue gagne) — un vrai NLU serait
 * disproportionné pour un premier jeu de questions ; se durcira avec
 * l'usage réel plutôt que d'être deviné à l'avance.
 */
export async function routeIntent(question: string, userId: string): Promise<AskNaviIntent> {
  const normalizedQuestion = normalize(question);

  const hotels = await prisma.hotel.findMany({ select: { id: true, name: true } });
  const matchedHotel = hotels
    .filter((hotel) => hotel.name.length >= 3 && normalizedQuestion.includes(normalize(hotel.name)))
    .sort((a, b) => b.name.length - a.name.length)[0];

  if (matchedHotel) {
    return containsAny(normalizedQuestion, HISTORY_KEYWORDS)
      ? { type: "hotel-history", hotelId: matchedHotel.id, hotelName: matchedHotel.name }
      : { type: "hotel-health", hotelId: matchedHotel.id, hotelName: matchedHotel.name };
  }

  const portfolios = await prisma.portfolio.findMany({ where: { ownerId: userId }, select: { id: true, name: true } });
  const matchedPortfolio = portfolios
    .filter((portfolio) => portfolio.name.length >= 3 && normalizedQuestion.includes(normalize(portfolio.name)))
    .sort((a, b) => b.name.length - a.name.length)[0];

  if (matchedPortfolio) {
    return { type: "portfolio-signals", portfolioId: matchedPortfolio.id, portfolioName: matchedPortfolio.name };
  }

  if (containsAny(normalizedQuestion, OPPORTUNITY_KEYWORDS)) return { type: "top-opportunities" };
  if (containsAny(normalizedQuestion, WITHOUT_SCAN_KEYWORDS)) return { type: "hotels-without-recent-scan" };

  // Un mot-clé "signal/alerte/vigilance" sans portefeuille reconnu ne
  // correspond à aucune des 5 fonctions (getPortfolioSignals exige un
  // portefeuille) — mieux vaut laisser Ask NAVI demander une précision
  // que d'inventer un contexte "tous portefeuilles confondus" qui
  // n'existe pas dans le Context Builder.
  if (containsAny(normalizedQuestion, SIGNAL_KEYWORDS)) return { type: "unknown" };

  return { type: "unknown" };
}
