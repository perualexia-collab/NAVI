import { useMemo, useState } from "react";
import { Card } from "../components/ui/Card.js";
import { ScoreRing } from "../components/ui/ScoreRing.js";
import { TrendLabel } from "../components/ui/StatusPill.js";
import { DateRangeControl } from "../components/ui/DateRangeControl.js";
import { Icon } from "../components/ui/icons.js";
import { HotelsTable } from "../components/HotelsTable.js";
import { hotelsByPortfolio, portfolios } from "../mock/data.js";

const STATUS_FILTERS = ["Tous les statuts", "Excellent", "Sain", "À surveiller", "Critique", "Aucun scan"] as const;

export function Portfolios() {
  const [selectedId, setSelectedId] = useState(portfolios[0]!.id);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("Tous les statuts");

  const selected = portfolios.find((p) => p.id === selectedId) ?? portfolios[0]!;

  const hotels = useMemo(() => {
    return hotelsByPortfolio(selected.id).filter((hotel) => {
      const matchesSearch = hotel.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "Tous les statuts" || hotel.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [selected.id, search, statusFilter]);

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl">Mes portefeuilles</h1>
          <p className="mt-1 text-sm text-graphite-soft">Organisez vos ensembles d'hôtels et suivez leur santé CRM globale.</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          <Icon.Plus width={16} height={16} /> Nouveau portefeuille
        </button>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4">
        {portfolios.map((portfolio) => {
          const isSelected = portfolio.id === selected.id;
          return (
            <button key={portfolio.id} onClick={() => setSelectedId(portfolio.id)} className="text-left">
              <Card className={isSelected ? "border-terracotta" : "hover:border-graphite/20"}>
                <div className="text-sm font-medium">{portfolio.name}</div>
                <div className="text-xs text-graphite-faint">{portfolio.hotelCount} hôtels</div>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-graphite-faint">Santé CRM</div>
                    <TrendLabel delta={portfolio.healthDelta} />
                    <div className="text-[10px] text-graphite-faint">vs période précédente</div>
                  </div>
                  <ScoreRing score={portfolio.healthScore} size={48} strokeWidth={5} />
                </div>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-graphite-soft">
                  <LegendDot color="bg-sage" label={`${portfolio.scannedCount} scannés`} />
                  <LegendDot color="bg-warn" label={`${portfolio.toScanCount} à scanner`} />
                  <LegendDot color="bg-alert" label={`${portfolio.criticalCount} critique`} />
                </div>
              </Card>
            </button>
          );
        })}
      </div>

      <Card className="mt-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            Détail du portefeuille : {selected.name}
            <span className="rounded-full bg-linen-deep px-2 py-0.5 text-xs font-normal text-graphite-soft">{selected.hotelCount} hôtels</span>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-1 min-w-[200px] items-center gap-2 rounded-lg border border-graphite/15 px-3 py-2 text-sm">
            <Icon.Search width={15} height={15} className="text-graphite-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un hôtel…"
              className="w-full bg-transparent outline-none placeholder:text-graphite-faint"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as (typeof STATUS_FILTERS)[number])}
            className="rounded-lg border border-graphite/15 bg-linen px-3 py-2 text-sm text-graphite-soft"
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <DateRangeControl />
          <button className="flex items-center gap-1.5 rounded-lg bg-sage px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            <Icon.Play width={14} height={14} /> Lancer un scan portefeuille
          </button>
        </div>

        <HotelsTable hotels={hotels} />
      </Card>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} /> {label}
    </span>
  );
}
