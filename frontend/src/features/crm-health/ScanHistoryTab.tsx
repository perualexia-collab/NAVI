import { Card } from "../../components/ui/Card.js";
import { StatusPill } from "../../components/ui/StatusPill.js";
import { formatDateTime } from "../../lib/format.js";
import { mockScanHistory } from "../../mock/signals.js";

export function ScanHistoryTab() {
  return (
    <Card>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-graphite/10 text-left text-[11px] uppercase tracking-wide text-graphite-faint">
            <th className="pb-2 font-medium">Date du scan</th>
            <th className="pb-2 font-medium">Période analysée</th>
            <th className="pb-2 font-medium">Durée</th>
            <th className="pb-2 font-medium">Santé CRM</th>
            <th className="pb-2 font-medium">Statut</th>
          </tr>
        </thead>
        <tbody>
          {mockScanHistory.map((scan) => (
            <tr key={scan.scannedAt} className="border-b border-graphite/5 last:border-0">
              <td className="py-2.5">{formatDateTime(scan.scannedAt)}</td>
              <td className="text-graphite-soft">{scan.period}</td>
              <td className="text-graphite-soft tabular-nums">{scan.durationLabel}</td>
              <td className="tabular-nums font-medium">{scan.healthScore}/100</td>
              <td>
                <StatusPill status={scan.status === "SUCCESS" ? "Excellent" : "À surveiller"} />
                {scan.status === "PARTIAL_SUCCESS" && (
                  <span className="ml-2 text-xs text-graphite-faint">terminé avec données manquantes</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
