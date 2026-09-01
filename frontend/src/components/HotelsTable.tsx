import { Link } from "react-router-dom";
import type { MockHotel } from "../mock/types.js";
import { ScoreRing } from "./ui/ScoreRing.js";
import { StatusPill } from "./ui/StatusPill.js";
import { StarRating } from "./ui/StarRating.js";
import { Icon } from "./ui/icons.js";
import { formatDate } from "../lib/format.js";

const Dash = () => <span className="text-graphite-faint">—</span>;

export function HotelsTable({ hotels, showPortfolio = false }: { hotels: MockHotel[]; showPortfolio?: boolean }) {
  if (hotels.length === 0) {
    return <p className="py-8 text-center text-sm text-graphite-faint">Aucun hôtel ne correspond à cette recherche.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-graphite/10 text-left text-[11px] uppercase tracking-wide text-graphite-faint">
            <th className="pb-2 font-medium">Hôtel</th>
            {showPortfolio && <th className="pb-2 font-medium">Portefeuille</th>}
            <th className="pb-2 font-medium">Dernier scan</th>
            <th className="pb-2 font-medium">Santé CRM</th>
            <th className="pb-2 font-medium">Alertes</th>
            <th className="pb-2 font-medium">Vigilances</th>
            <th className="pb-2 font-medium">Opportunités</th>
            <th className="pb-2 font-medium">Statut</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody>
          {hotels.map((hotel) => (
            <tr key={hotel.id} className="border-b border-graphite/5 last:border-0 hover:bg-linen-deep/40">
              <td className="py-3">
                <Link to={`/crm-health/${hotel.id}`} className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linen-deep text-graphite-soft">
                    <Icon.Building width={15} height={15} />
                  </div>
                  <div>
                    <div className="font-medium text-graphite">{hotel.name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-graphite-faint">
                      {hotel.city} <StarRating value={hotel.starRating} />
                    </div>
                  </div>
                </Link>
              </td>
              {showPortfolio && <td className="text-graphite-soft">{hotel.portfolioName}</td>}
              <td className="text-graphite-soft">{hotel.lastScanAt ? formatDate(hotel.lastScanAt) : <Dash />}</td>
              <td>
                {hotel.healthScore !== null ? (
                  <div className="flex items-center gap-2">
                    <ScoreRing score={hotel.healthScore} size={34} strokeWidth={4} />
                  </div>
                ) : (
                  <Dash />
                )}
              </td>
              <td className="tabular-nums text-graphite-soft">{hotel.alerts ?? <Dash />}</td>
              <td className="tabular-nums text-graphite-soft">{hotel.vigilances ?? <Dash />}</td>
              <td className="tabular-nums text-graphite-soft">{hotel.opportunities ?? <Dash />}</td>
              <td><StatusPill status={hotel.status} /></td>
              <td className="text-right text-graphite-faint">
                <button aria-label="Actions" className="rounded p-1 hover:bg-linen-deep">
                  <Icon.MoreVertical width={16} height={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
