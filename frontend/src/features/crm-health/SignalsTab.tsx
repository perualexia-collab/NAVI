import { useState } from "react";
import { Card } from "../../components/ui/Card.js";
import { formatNumber } from "../../lib/format.js";
import { mockAudienceComparisons, signalCatalogue, type SignalCatalogueEntry } from "../../mock/signals.js";

const SEVERITY_LABEL: Record<SignalCatalogueEntry["severity"], string> = {
  ALERT: "Alerte",
  VIGILANCE: "Vigilance",
  OPPORTUNITY: "Opportunité"
};

const SEVERITY_STYLE: Record<SignalCatalogueEntry["severity"], string> = {
  ALERT: "bg-alert-soft text-alert-ink",
  VIGILANCE: "bg-warn-soft text-warn-ink",
  OPPORTUNITY: "bg-sage-soft text-sage-ink"
};

function actionLabel(signal: SignalCatalogueEntry): string | null {
  if (signal.audienceMode === "NONE") return null;
  if (signal.audienceMode === "MULTIPLE") {
    return signal.severity === "OPPORTUNITY" ? "Comparer les opportunités" : "Comparer les audiences";
  }
  return "Calculer l'audience";
}

/**
 * Onglets Alertes / Vigilances / Opportunités — contenu illustratif
 * (catalogue réel, association à l'hôtel mockée). Démontre le modèle
 * d'audience validé : action directe si option unique, comparaison des
 * volumes avant choix si plusieurs options (P10 / P11).
 */
export function SignalsTab({ severity }: { severity: SignalCatalogueEntry["severity"] }) {
  const signals = signalCatalogue.filter((s) => s.severity === severity);

  return (
    <div className="flex flex-col gap-3">
      {signals.map((signal) => (
        <SignalCard key={signal.playbookId} signal={signal} />
      ))}
    </div>
  );
}

function SignalCard({ signal }: { signal: SignalCatalogueEntry }) {
  const [expanded, setExpanded] = useState(false);
  const label = actionLabel(signal);
  const comparison = mockAudienceComparisons[signal.playbookId];

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLE[signal.severity]}`}>
            {SEVERITY_LABEL[signal.severity]}
          </span>
          <h3 className="mt-2 text-sm font-semibold">{signal.name}</h3>
          <p className="mt-1 text-xs text-graphite-faint">{signal.conditionDescription}</p>
          <p className="mt-2 text-sm text-graphite-soft">{signal.recommendedAction}</p>
        </div>
        {label && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 rounded-lg border border-terracotta px-3 py-1.5 text-xs font-medium text-terracotta hover:bg-terracotta-soft"
          >
            {label}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-4 border-t border-graphite/10 pt-4">
          {comparison ? (
            <div className="flex flex-col gap-2">
              {comparison.map((option) => (
                <div key={option.name} className="flex items-center justify-between rounded-lg bg-linen-deep/60 px-3 py-2 text-sm">
                  <span>{option.highlighted ? "⭐ " : ""}{option.name}</span>
                  <span className="font-medium tabular-nums">{formatNumber(option.recipients)} clients</span>
                </div>
              ))}
              <p className="mt-1 text-xs text-graphite-faint">
                Volumes mesurés (simulation Phase B) — le vrai calcul interrogera Expérience via le moteur Playwright (Phase F).
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg bg-linen-deep/60 px-3 py-2 text-sm">
              <span>Audience proposée</span>
              <span className="font-medium tabular-nums">312 clients (simulation)</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
