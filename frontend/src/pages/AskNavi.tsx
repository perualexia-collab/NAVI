import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardHeader } from "../components/ui/Card.js";
import { Icon } from "../components/ui/icons.js";
import { conversationHistory as initialHistory, moreSuggestedQuestions } from "../mock/ask-navi.js";
import { api, ApiError } from "../lib/api.js";
import type { AskNaviHistoryTurn, AskNaviSource } from "../lib/real-hotel-types.js";

interface ConversationEntry {
  id: string;
  question: string;
  askedAt: string;
  status: "pending" | "success" | "error";
  answer?: string;
  sources?: AskNaviSource[];
  errorMessage?: string;
}

const MAX_HISTORY_TURNS = 3;

/**
 * Ask NAVI — branché sur POST /api/ask-navi (Phase H3/H4) : question →
 * routeIntent() → Context Builder → LLM Service → réponse réelle.
 * Mémoire conversationnelle (retour réel 2026-09-03) : les derniers
 * échanges réussis du fil sont envoyés à chaque nouvelle question, pour
 * qu'une relance elliptique ("détaille les actions") reste rattachée au
 * bon hôtel/portefeuille — gérée uniquement côté client (jamais
 * persistée côté backend, comme le reste de cette page). "Questions
 * suggérées" reste un jeu d'exemples statique, pas une fonctionnalité
 * connectée.
 */
export function AskNavi() {
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [history, setHistory] = useState(initialHistory);

  const askMutation = useMutation({
    mutationFn: (vars: { id: string; question: string; history: AskNaviHistoryTurn[] }) => api.askNavi(vars.question, vars.history),
    onSuccess: (data, vars) => {
      setConversation((prev) =>
        prev.map((entry) => (entry.id === vars.id ? { ...entry, status: "success", answer: data.answer, sources: data.sources } : entry))
      );
    },
    onError: (error, vars) => {
      const message = error instanceof ApiError ? error.message : "Ask NAVI n'a pas pu répondre — réessaie dans un instant.";
      setConversation((prev) => prev.map((entry) => (entry.id === vars.id ? { ...entry, status: "error", errorMessage: message } : entry)));
    }
  });

  const isAsking = conversation.some((entry) => entry.status === "pending");
  const lastAnsweredSources = [...conversation].reverse().find((entry) => entry.status === "success")?.sources ?? [];

  // Retour réel 2026-09-03 : une double-soumission (Entrée pressée deux
  // fois très vite) passait à travers `isAsking` — dérivé de l'état React,
  // pas encore recalculé au moment du second appel synchrone. Une ref
  // évite la course, indépendamment du rendu.
  const sendingRef = useRef(false);

  function sendQuestion(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sendingRef.current) return;
    sendingRef.current = true;
    const recentTurns: AskNaviHistoryTurn[] = conversation
      .filter((entry): entry is ConversationEntry & { answer: string } => entry.status === "success" && entry.answer !== undefined)
      .slice(-MAX_HISTORY_TURNS)
      .map((entry) => ({ question: entry.question, answer: entry.answer }));
    const id = `${Date.now()}-${conversation.length}`;
    setConversation((prev) => [...prev, { id, question: trimmed, askedAt: "À l'instant", status: "pending" }]);
    setHistory((prev) => [{ title: trimmed, timestamp: "À l'instant" }, ...prev]);
    setQuestion("");
    askMutation.mutate({ id, question: trimmed, history: recentTurns }, { onSettled: () => { sendingRef.current = false; } });
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl"><Icon.Sparkles className="text-terracotta" /> Ask NAVI</h1>
          <p className="mt-1 text-sm text-graphite-soft">Posez vos questions, NAVI analyse vos données CRM et vous apporte des réponses.</p>
        </div>
        <button
          onClick={() => {
            setConversation([]);
            setQuestion("");
          }}
          className="flex items-center gap-1.5 rounded-lg bg-sage px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Icon.Plus width={14} height={14} /> Nouvelle conversation
        </button>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-5">
        <div className="col-span-2 flex flex-col gap-4">
          <Card>
            <form
              onSubmit={(e) => { e.preventDefault(); sendQuestion(question); }}
              className="flex items-center gap-2 rounded-lg border border-graphite/15 px-3 py-2"
            >
              <Icon.Sparkles className="text-graphite-faint" width={16} height={16} />
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Posez une question à NAVI…"
                className="w-full bg-transparent text-sm outline-none"
              />
              <button
                type="submit"
                disabled={isAsking}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-terracotta text-white hover:opacity-90 disabled:opacity-50"
              >
                <Icon.Send width={14} height={14} />
              </button>
            </form>
          </Card>

          {conversation.map((entry) => (
            <ConversationExchange key={entry.id} entry={entry} />
          ))}

          {conversation.length > 0 && (
            <p className="text-center text-xs text-graphite-faint">NAVI peut faire des erreurs. Vérifiez toujours les informations critiques.</p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Sources utilisées" />
            {lastAnsweredSources.length === 0 ? (
              <p className="text-sm text-graphite-faint">Posez une question pour voir ici les données utilisées par NAVI pour répondre.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {lastAnsweredSources.map((source) => (
                  <div key={source.label} className="flex items-start gap-2 text-sm">
                    <Icon.Info width={14} height={14} className="mt-0.5 text-graphite-faint" />
                    <div>
                      <div className="font-medium">{source.label}</div>
                      <div className="text-xs text-graphite-faint">{source.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Questions suggérées" />
            <div className="flex flex-col divide-y divide-graphite/10">
              {moreSuggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuestion(q)}
                  className="py-2 text-left text-sm text-graphite-soft first:pt-0 last:pb-0 hover:text-terracotta"
                >
                  {q}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Historique des conversations" action={<button className="text-xs text-terracotta hover:underline">Voir tout →</button>} />
            <div className="flex flex-col divide-y divide-graphite/10">
              {history.map((c, i) => (
                <div key={`${c.title}-${i}`} className="py-2 first:pt-0 last:pb-0">
                  <div className="text-sm">{c.title}</div>
                  <div className="text-xs text-graphite-faint">{c.timestamp}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Un échange : la question de l'utilisateur, puis la réponse réelle d'Ask NAVI (ou son état en cours / d'erreur). */
function ConversationExchange({ entry }: { entry: ConversationEntry }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-terracotta-soft px-4 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-terracotta-ink/70">Vous · {entry.askedAt}</div>
          <p className="mt-0.5 text-sm text-terracotta-ink">{entry.question}</p>
        </div>
      </div>
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-graphite/10 bg-linen px-4 py-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-graphite-faint">
            <Icon.Sparkles width={11} height={11} className="text-terracotta" /> NAVI
          </div>
          {entry.status === "pending" && <p className="text-sm text-graphite-faint">NAVI réfléchit…</p>}
          {entry.status === "success" && <p className="whitespace-pre-wrap text-sm text-graphite-soft">{entry.answer}</p>}
          {entry.status === "error" && (
            <div className="flex items-start gap-2 text-sm text-alert">
              <Icon.AlertTriangle width={14} height={14} className="mt-0.5 shrink-0" />
              <span>{entry.errorMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
