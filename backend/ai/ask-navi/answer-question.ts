import type { LlmService } from "../llm-service/index.js";
import {
  getHotelHealth,
  getHotelsWithoutRecentScan,
  getPortfolioSignals,
  getScanHistory,
  getTopOpportunities
} from "../context-builder/index.js";
import { routeIntent } from "./route-intent.js";
import type { AskNaviAnswer, AskNaviSource } from "./types.js";

// "NAVI décide, Qwen explique" (§09 Architecture Proposal) : le modèle ne
// reçoit jamais un accès libre à la base, seulement le contexte JSON déjà
// calculé par le Context Builder ci-dessous — il ne recalcule jamais un
// score, il le met en mots.
const SYSTEM_PROMPT = `Tu es Ask NAVI, l'assistant conversationnel du copilote CRM NAVI pour des hôtels, posé au-dessus du CRM Expérience (D-EDGE).

Règles strictes, jamais négociables :
- Tu ne calcules JAMAIS toi-même un score, un pourcentage, un montant ou une évolution : tu reformules et expliques uniquement les données déjà calculées fournies dans le contexte JSON ci-dessous. Si un chiffre n'y figure pas, ne l'invente pas.
- Si le contexte est vide ou insuffisant pour répondre, dis-le honnêtement et demande une précision (le nom exact d'un hôtel ou d'un portefeuille) plutôt que de répondre dans le vide.
- Ne mentionne jamais un identifiant technique interne (playbookId type "P06", uuid, code interne) — uniquement des noms et libellés lisibles par un humain.
- Réponds en français, de façon concise (quelques phrases, pas un long rapport), professionnelle et actionnable pour un utilisateur hôtelier.`;

export interface AnswerQuestionOptions {
  question: string;
  userId: string;
  llmService: LlmService;
}

export async function answerQuestion(options: AnswerQuestionOptions): Promise<AskNaviAnswer> {
  const intent = await routeIntent(options.question, options.userId);

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
    case "top-opportunities":
      context = await getTopOpportunities(5);
      sources = [{ label: "Opportunités actives", detail: "Meilleures opportunités, tous hôtels confondus" }];
      break;
    case "hotels-without-recent-scan":
      context = await getHotelsWithoutRecentScan(30);
      sources = [{ label: "Fraîcheur des scans", detail: "Hôtels jamais scannés ou scannés il y a plus de 30 jours" }];
      break;
    case "unknown":
      context = null;
      sources = [];
      break;
  }

  // Défensif : par construction routeIntent() ne renvoie que des
  // identifiants déjà vérifiés (hôtel existant, portefeuille possédé par
  // l'utilisateur), donc `context` ne devrait jamais être null ici en
  // dehors de "unknown" — mais si ça arrivait quand même, traiter comme
  // "pas de contexte" plutôt que planter la requête ou fabriquer un
  // contexte vide silencieux.
  const hasContext = context !== null && context !== undefined;

  const userMessage = hasContext
    ? `Question de l'utilisateur : ${options.question}\n\nContexte disponible (déjà calculé par NAVI) :\n${JSON.stringify(context, null, 2)}`
    : `Question de l'utilisateur : ${options.question}\n\nAucun contexte identifié : ni hôtel ni portefeuille reconnu dans la question, et aucun mot-clé ne correspond à une donnée que tu peux consulter (opportunités, hôtels non scannés récemment). Demande une précision à l'utilisateur (nom exact d'un hôtel ou d'un portefeuille) plutôt que de répondre dans le vide.`;

  const result = await options.llmService.complete({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage }
    ],
    // Retour réel 2026-09-03 : reasoningFormat "hidden" masque le
    // raisonnement mais ne l'empêche pas d'être généré — il consomme
    // quand même le quota "tokens de sortie / minute" du plan gratuit
    // Groq (1000 OTPM sur qwen/qwen3.6-27b). `reasoningEffort: "none"`
    // (censé désactiver réellement le raisonnement) a été essayé mais
    // RETIRÉ : sur un appel il s'est comporté normalement, sur le
    // suivant (20s plus tard) Groq a rejeté la requête en annonçant
    // "Requested 1296" alors que maxTokens valait 600 — signe que ce
    // paramètre fait gonfler l'estimation interne de Groq de façon
    // imprévisible pour ce modèle, plutôt que de réduire la consommation
    // réelle. maxTokens seul (sans reasoningEffort) s'est comporté de
    // façon prévisible (le "Requested" annoncé par Groq correspondait
    // exactement à la valeur demandée) — préféré ici tant que ce n'est
    // pas éclairci. Valeur volontairement basse pour laisser de la marge
    // au raisonnement caché dans le quota de 1000 OTPM.
    maxTokens: 450,
    reasoningFormat: "hidden"
  });

  // Filet de sécurité : quelle qu'en soit la cause (budget de tokens,
  // erreur provider silencieuse...), ne jamais renvoyer une bulle vide à
  // l'utilisateur.
  const answer = result.text.trim() || "NAVI n'a pas réussi à formuler de réponse complète — reformule ta question ou réessaie.";

  return { answer, intent: intent.type, sources: hasContext ? sources : [] };
}
