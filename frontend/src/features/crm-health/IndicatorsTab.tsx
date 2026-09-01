import type { MockHotel } from "../../mock/types.js";
import { Card } from "../../components/ui/Card.js";
import { galileoKpis } from "../../mock/hotel-detail.js";

export function IndicatorsTab({ hotel }: { hotel: MockHotel }) {
  if (hotel.id !== "h-galileo") {
    return (
      <Card>
        <p className="text-sm text-graphite-soft">
          Détail des indicateurs mocké uniquement pour l'Hôtel Galileo à ce stade de la Phase B.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-graphite/10 text-left text-[11px] uppercase tracking-wide text-graphite-faint">
            <th className="pb-2 font-medium">Indicateur</th>
            <th className="pb-2 font-medium">Valeur</th>
            <th className="pb-2 font-medium">Évolution</th>
            <th className="pb-2 font-medium">Statut</th>
          </tr>
        </thead>
        <tbody>
          {galileoKpis.map((kpi) => (
            <tr key={kpi.label} className="border-b border-graphite/5 last:border-0">
              <td className="py-2.5 font-medium">{kpi.label}</td>
              <td className="tabular-nums">{kpi.value}</td>
              <td className={`tabular-nums font-medium ${kpi.trend === "down" ? "text-alert" : "text-sage"}`}>{kpi.delta}</td>
              <td><span className="rounded bg-linen-deep px-2 py-0.5 text-xs text-graphite-soft">{kpi.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
