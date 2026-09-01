import { Card, CardHeader } from "../../components/ui/Card.js";
import { Icon } from "../../components/ui/icons.js";
import { formatDateTime, formatNumber } from "../../lib/format.js";
import { mockAudienceHistory } from "../../mock/signals.js";

export function AudiencesTab() {
  return (
    <Card>
      <CardHeader icon={<Icon.Briefcase className="text-graphite-faint" width={15} height={15} />} title="Audiences déjà calculées" />
      {mockAudienceHistory.length === 0 ? (
        <p className="text-sm text-graphite-faint">Aucune audience calculée pour cet hôtel.</p>
      ) : (
        <div className="flex flex-col divide-y divide-graphite/10">
          {mockAudienceHistory.map((audience) => (
            <div key={audience.name} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div>
                <div className="text-sm font-medium">{audience.name}</div>
                <div className="text-xs text-graphite-faint">Calculée le {formatDateTime(audience.measuredAt)}</div>
              </div>
              <span className="rounded-lg bg-linen-deep px-3 py-1 text-sm font-medium tabular-nums">
                {formatNumber(audience.recipients)} clients
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-graphite-faint">
        Le calcul d'audience est toujours déclenché depuis une recommandation (onglets Alertes / Vigilances /
        Opportunités) — il n'existe pas d'Audience Builder indépendant dans NAVI (brief §22).
      </p>
    </Card>
  );
}
