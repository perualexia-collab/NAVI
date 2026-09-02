import { useState } from "react";
import { Card, CardHeader } from "../components/ui/Card.js";
import { Icon } from "../components/ui/icons.js";
import { conversationHistory as initialHistory, mockAnswer, moreSuggestedQuestions, suggestedQuestions } from "../mock/ask-navi.js";

interface ConversationEntry {
  id: string;
  question: string;
  askedAt: string;
}

/**
 * Ask NAVI — retours Phase C.5 (3ᵉ passe, ciblée) : vrai point d'entrée de
 * chat unique (plus de question préremplie ni de réponse mockée affichée
 * par défaut). Tant que le moteur IA n'est pas branché (Phase F/H), on
 * n'invente ni réponse ni traitement : chaque question envoyée apparaît
 * dans le fil ("Vous" / "NAVI"), NAVI répondant honnêtement qu'aucun
 * fournisseur LLM n'est encore connecté — la structure de la conversation
 * (question + réponse empilées) est déjà celle d'un vrai échange, prête à
 * accueillir une réponse réelle le jour venu.
 */
export function AskNavi() {
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [history, setHistory] = useState(initialHistory);

  function sendQuestion(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setConversation((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, question: trimmed, askedAt: "À l'instant" }]);
    setHistory((prev) => [{ title: trimmed, timestamp: "À l'instant" }, ...prev]);
    setQuestion("");
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
              <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg bg-terracotta text-white hover:opacity-90">
                <Icon.Send width={14} height={14} />
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuestion(q)}
                  className="rounded-full border border-graphite/15 px-3 py-1 text-xs text-graphite-soft hover:border-terracotta hover:text-terracotta"
                >
                  {q}
                </button>
              ))}
            </div>
          </Card>

          {conversation.map((entry) => (
            <ConversationExchange key={entry.id} question={entry.question} askedAt={entry.askedAt} />
          ))}

          {conversation.length > 0 && (
            <p className="text-center text-xs text-graphite-faint">NAVI peut faire des erreurs. Vérifiez toujours les informations critiques.</p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Sources utilisées" />
            <div className="flex flex-col gap-3">
              {mockAnswer.sources.map((source) => (
                <div key={source.label} className="flex items-start gap-2 text-sm">
                  <Icon.Info width={14} height={14} className="mt-0.5 text-graphite-faint" />
                  <div>
                    <div className="font-medium">{source.label}</div>
                    <div className="text-xs text-graphite-faint">{source.detail}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-3 text-xs font-medium text-terracotta hover:underline">Voir le détail des sources →</button>
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

/**
 * Un échange : la question de l'utilisateur, puis la réponse NAVI. Tant
 * que l'IA n'est pas connectée, la "réponse" est un état honnête plutôt
 * qu'un contenu inventé — mais la structure (question puis réponse,
 * empilées dans le fil) est déjà celle d'une vraie conversation.
 */
function ConversationExchange({ question, askedAt }: { question: string; askedAt: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-terracotta-soft px-4 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-terracotta-ink/70">Vous · {askedAt}</div>
          <p className="mt-0.5 text-sm text-terracotta-ink">{question}</p>
        </div>
      </div>
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-graphite/10 bg-linen px-4 py-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-graphite-faint">
            <Icon.Sparkles width={11} height={11} className="text-terracotta" /> NAVI
          </div>
          <div className="flex items-start gap-2 text-sm text-graphite-soft">
            <Icon.Info width={14} height={14} className="mt-0.5 shrink-0 text-horizon" />
            <span>NAVI n'est pas encore connecté à un fournisseur LLM — impossible de générer une réponse à cette question pour l'instant.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
