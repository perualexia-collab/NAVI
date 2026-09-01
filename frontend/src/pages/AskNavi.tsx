import { useState } from "react";
import { Card, CardHeader } from "../components/ui/Card.js";
import { Icon } from "../components/ui/icons.js";
import { formatCurrency, formatNumber } from "../lib/format.js";
import { conversationHistory, mockAnswer, moreSuggestedQuestions, suggestedQuestions } from "../mock/ask-navi.js";

const PRIORITY_STYLE = {
  "Priorité haute": "bg-alert-soft text-alert-ink",
  "Priorité moyenne": "bg-warn-soft text-warn-ink"
} as const;

export function AskNavi() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState(true); // true = montre la réponse mockée, comme dans le mockup
  // Question réellement envoyée par l'utilisateur, différente de la question
  // mockée illustrative — aucun provider LLM n'est encore connecté (retours
  // Phase C.5, §8) : on ne fabrique pas de réponse, on le dit honnêtement.
  const [sentQuestion, setSentQuestion] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState("");

  function sendQuestion(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed === mockAnswer.question) {
      setAsked(true);
      setSentQuestion(null);
    } else {
      setAsked(false);
      setSentQuestion(trimmed);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl"><Icon.Sparkles className="text-terracotta" /> Ask NAVI</h1>
          <p className="mt-1 text-sm text-graphite-soft">Posez vos questions, NAVI analyse vos données CRM et vous apporte des réponses.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAsked(false);
              setSentQuestion(null);
              setQuestion("");
            }}
            className="flex items-center gap-1.5 rounded-lg bg-sage px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Icon.Plus width={14} height={14} /> Nouvelle conversation
          </button>
        </div>
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
                value={asked ? mockAnswer.question : question}
                onChange={(e) => setQuestion(e.target.value)}
                onFocus={() => setAsked(false)}
                placeholder="Quels sont les segments de clients à réactiver en priorité sur l'hôtel Galileo ?"
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
                  onClick={() => {
                    setQuestion(q);
                    setAsked(false);
                    setSentQuestion(null);
                  }}
                  className="rounded-full border border-graphite/15 px-3 py-1 text-xs text-graphite-soft hover:border-terracotta hover:text-terracotta"
                >
                  {q}
                </button>
              ))}
            </div>
          </Card>

          {sentQuestion && (
            <Card>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Icon.Info className="text-horizon" width={16} height={16} /> NAVI n'est pas encore connecté à un fournisseur LLM
              </div>
              <p className="text-sm text-graphite-soft">
                Votre question a bien été envoyée : « {sentQuestion} ». Aucun fournisseur LLM n'est configuré pour
                l'instant — NAVI ne peut donc pas encore générer de réponse réelle à cette question.
              </p>
            </Card>
          )}

          {asked && (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Icon.Sparkles className="text-terracotta" width={16} height={16} /> NAVI · Réponse générée à partir de vos données CRM
                </div>
                <span className="text-xs text-graphite-faint">{mockAnswer.respondedAt}</span>
              </div>

              <p className="text-sm text-graphite-soft">{mockAnswer.intro}</p>

              <div className="mt-4 flex flex-col gap-3">
                {mockAnswer.segments.map((segment) => (
                  <div key={segment.rank} className="rounded-lg border border-graphite/10 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sage-soft text-xs font-semibold text-sage-ink">{segment.rank}</span>
                        <span className="text-sm font-semibold">{segment.name}</span>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[segment.priority]}`}>{segment.priority}</span>
                    </div>
                    <p className="mt-2 text-sm text-graphite-soft">{segment.description}</p>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                      <MiniStat label="Clients concernés" value={formatNumber(segment.concernedClients)} />
                      <MiniStat label="CA potentiel estimé" value={formatCurrency(segment.potentialRevenue)} />
                      <MiniStat label="Panier moyen" value={formatCurrency(segment.averageBasket)} />
                      <MiniStat label="Taux de réactivation observé" value={`${segment.reactivationRate} %`} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-lg bg-horizon-soft px-3 py-2 text-sm text-horizon-ink">
                <Icon.Info width={15} height={15} />
                Ces segments représentent un CA potentiel total estimé à {formatCurrency(mockAnswer.totalPotentialRevenue)}.
              </div>
              <p className="mt-2 text-xs text-graphite-faint">
                Les estimations sont basées sur l'historique CRM et peuvent varier. NAVI ne garantit pas la réalisation
                effective de ce potentiel.
              </p>

              <div className="mt-3 flex items-center justify-between border-t border-graphite/10 pt-3">
                <div className="flex items-center gap-3 text-graphite-faint">
                  <button aria-label="Réponse utile" className="hover:text-sage"><Icon.ThumbsUp width={16} height={16} /></button>
                  <button aria-label="Réponse pas utile" className="hover:text-alert"><Icon.ThumbsDown width={16} height={16} /></button>
                </div>
                <button className="rounded-lg border border-graphite/15 px-3 py-1.5 text-xs font-medium text-graphite-soft hover:border-terracotta hover:text-terracotta">
                  Exporter le résultat
                </button>
              </div>
            </Card>
          )}

          <Card>
            <form
              onSubmit={(e) => { e.preventDefault(); sendQuestion(followUp); setFollowUp(""); }}
              className="flex items-center gap-2"
            >
              <input
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                placeholder="Posez une nouvelle question à NAVI…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-graphite-faint"
              />
              <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg bg-terracotta text-white hover:opacity-90">
                <Icon.Send width={14} height={14} />
              </button>
            </form>
          </Card>
          <p className="text-center text-xs text-graphite-faint">NAVI peut faire des erreurs. Vérifiez toujours les informations critiques.</p>
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
                  onClick={() => {
                    setQuestion(q);
                    setAsked(false);
                  }}
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
              {conversationHistory.map((c) => (
                <div key={c.title} className="py-2 first:pt-0 last:pb-0">
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-linen-deep/60 p-2">
      <div className="font-display text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] text-graphite-faint">{label}</div>
    </div>
  );
}
