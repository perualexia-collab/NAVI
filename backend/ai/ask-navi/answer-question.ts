import type { LlmMessage, LlmService } from "../llm-service/index.js";
import {
  getAllHotelsOverview,
  getHotelHealth,
  getHotelsWithoutRecentScan,
  getPortfolioFinancials,
  getPortfolioSignals,
  getScanHistory,
  getTopOpportunities
} from "../context-builder/index.js";
import { routeIntent } from "./route-intent.js";
import type { AskNaviAnswer, AskNaviHistoryTurn, AskNaviSource } from "./types.js";

// "NAVI décide, Qwen explique" (§09 Architecture Proposal) : le modèle ne
// reçoit jamais un accès libre à la base, seulement le contexte JSON déjà
// calculé par le Context Builder ci-dessous — il ne recalcule jamais un
// score ni une somme, il les met en mots.
//
// Retour réel 2026-09-03 (3e round) : preuve directe par les logs
// (finishReason: "length", completionTokens === maxTokens) que le
// raisonnement caché de Qwen3.6 consomme À LUI SEUL tout le budget de
// tokens sur une question avec du contexte réel — reasoningFormat
// "hidden" masque ce raisonnement mais ne l'empêche jamais d'être
// généré. `reasoningEffort: "none"` avait été essayé puis retiré (il
// avait fait gonfler l'estimation "Requested" de Groq de façon
// imprévisible sur un appel suivant). Nouvelle tentative avec un
// mécanisme différent, cette fois au niveau du texte du prompt plutôt
// que d'un paramètre API spécial à Groq : "/no_think", le "soft switch"
// que le chat template de Qwen3.x reconnaît nativement pour désactiver
// le mode réflexion — invisible pour le système de quota de Groq (ce
// n'est qu'une ligne de texte dans le contenu, pas un champ de requête
// qu'il pourrait traiter spécialement).
const SYSTEM_PROMPT = `Tu es Ask NAVI, l'assistant conversationnel du copilote CRM NAVI pour des hôtels, posé au-dessus du CRM Expérience (D-EDGE).

Règles strictes, jamais négociables :
- Tu ne calcules JAMAIS toi-même un score, un pourcentage, un montant, une somme ou une évolution : tu reformules et expliques uniquement les données déjà calculées fournies dans le contexte JSON ci-dessous (y compris les totaux, déjà additionnés par NAVI). Si un chiffre n'y figure pas, ne l'invente pas et ne le recalcule pas toi-même.
- Si le contexte est insuffisant pour répondre précisément, dis-le honnêtement et demande une précision (le nom exact d'un hôtel ou d'un portefeuille) plutôt que de répondre dans le vide — mais le contexte "vue d'ensemble" ci-dessous te donne toujours au moins la liste réelle des hôtels/portefeuilles : appuie-toi dessus plutôt que de prétendre n'avoir aucune donnée.
- Ne mentionne jamais un identifiant technique interne (playbookId type "P06", uuid, code interne) — uniquement des noms et libellés lisibles par un humain.
- Réponds en français, de façon concise (quelques phrases, pas un long rapport), professionnelle et actionnable pour un utilisateur hôtelier.
- La conversation peut contenir des échanges précédents : une question elliptique ("détaille", "et pour celui-là ?") se rapporte au sujet dont vous veniez de parler.

/no_think`;

const MAX_HISTORY_TURNS = 3;

export interface AnswerQuestionOptions {
  question: string;
  userId: string;
  llmService: LlmService;
  /** Derniers échanges du même fil (le plus ancien en premier) — mémoire conversationnelle, retour réel 2026-09-03. */
  history?: AskNaviHistoryTurn[];
}

export async function answerQuestion(options: AnswerQuestionOptions): Promise<AskNaviAnswer> {
  const recentHistory = (options.history ?? []).slice(-MAX_HISTORY_TURNS);
  const recentHistoryText = recentHistory.map((turn) => `${turn.question} ${turn.answer}`).join(" ");

  const intent = await routeIntent(options.question, options.userId, recentHistoryText);

  let context: unknown = null;
  let sources: AskNaviSource[] = [];

  switch (intent.type) {
    case "hotel-health":
      context = await getHotelHealth(intent.hotelId);
      sources = [{ label: intent.hotelName, detail: "Santé CRM, KPI et signaux actifs — dernier scan connu" }];
      break;
    case "hotel-history":
      context = await getScanHistory(intent.hotelId);
      sources = [{ label: intent.hotelName, detail: "Historique des derniers scans" }];
      break;
    case "portfolio-signals":
      context = await getPortfolioSignals(options.userId, intent.portfolioId);
      sources = [{ label: intent.portfolioName, detail: "Signaux actifs du portefeuille" }];
      break;
    case "portfolio-financials":
      context = await getPortfolioFinancials(options.userId, intent.portfolioId);
      sources = [{ label: intent.portfolioName, detail: "CA et réservations générés, additionnés sur le portefeuille" }];
      break;
    case "top-opportunities":
      context = await getTopOpportunities(5);
      sources = [{ label: "Opportunités actives", detail: "Meilleures opportunités, tous hôtels confondus" }];
      break;
    case "hotels-without-recent-scan":
      context = await getHotelsWithoutRecentScan(30);
      sources = [{ label: "Fraîcheur des scans", detail: "Hôtels jamais scannés ou scannés il y a plus de 30 jours" }];
      break;
    case "org-overview":
      context = await getAllHotelsOverview();
      sources = [{ label: "Vue d'ensemble", detail: "Tous les hôtels — portefeuille(s), dernier scan, santé" }];
      break;
  }

  // Défensif : par construction routeIntent() ne renvoie que des
  // identifiants déjà vérifiés (hôtel existant, portefeuille possédé par
  // l'utilisateur), donc `context` ne devrait jamais être null ici — mais
  // si ça arrivait quand même, traiter comme "pas de contexte" plutôt que
  // planter la requête ou fabriquer un contexte vide silencieux.
  const hasContext = context !== null && context !== undefined;

  const userMessage = hasContext
    ? `Question de l'utilisateur : ${options.question}\n\nContexte disponible (déjà calculé par NAVI) :\n${JSON.stringify(context, null, 2)}`
    : `Question de l'utilisateur : ${options.question}\n\nAucun contexte disponible pour cette question.`;

  const messages: LlmMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...recentHistory.flatMap((turn): LlmMessage[] => [
      { role: "user", content: turn.question },
      { role: "assistant", content: turn.answer }
    ]),
    { role: "user", content: userMessage }
  ];

  const result = await options.llmService.complete({
    messages,
    // maxTokens redescendu (900 → 550) : avec /no_think dans le prompt
    // système (voir plus haut), la réponse ne devrait plus avoir à
    // "payer" un raisonnement cascadé de plusieurs centaines de tokens
    // avant le premier mot visible — 550 reste largement suffisant pour
    // "quelques phrases" (consigne du prompt) tout en laissant beaucoup
    // plus de marge dans le quota de 1000 OTPM/minute pour enchaîner
    // plusieurs questions. reasoningFormat "hidden" gardé en filet de
    // sécurité (sans effet si le raisonnement est déjà absent).
    maxTokens: 550,
    reasoningFormat: "hidden"
  });

  // Filet de sécurité : quelle qu'en soit la cause (budget de tokens,
  // erreur provider silencieuse...), ne jamais renvoyer une bulle vide à
  // l'utilisateur. Diagnostic loggé (jamais la clé, jamais le contenu
  // utilisateur au-delà de la question) pour comprendre la cause si ça
  // se reproduit malgré le budget relevé — un `finishReason: "length"`
  // confirme un budget encore trop juste pour cette question précise.
  const answer = result.text.trim();
  if (!answer) {
    console.warn("[ask-navi] Réponse vide du LLM", {
      intent: intent.type,
      finishReason: result.finishReason,
      usage: result.usage,
      questionLength: options.question.length
    });
  }

  return {
    answer: answer || "NAVI n'a pas réussi à formuler de réponse complète — reformule ta question ou réessaie.",
    intent: intent.type,
    sources: hasContext ? sources : []
  };
}
