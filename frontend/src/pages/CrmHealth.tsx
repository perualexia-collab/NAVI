import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui/Card.js";
import { DateRangeControl } from "../components/ui/DateRangeControl.js";
import { Icon } from "../components/ui/icons.js";
import { HotelsTable } from "../components/HotelsTable.js";
import { hotels } from "../mock/data.js";
import { api } from "../lib/api.js";

/** Filtres — brief §13, intitulés indicatifs. */
const FILTERS = ["Tous", "À surveiller", "Non scannés", "Erreur"] as const;
type Filter = (typeof FILTERS)[number];

function matchesFilter(hotel: (typeof hotels)[number], filter: Filter): boolean {
  switch (filter) {
    case "Tous":
      return true;
    case "À surveiller":
      return hotel.status === "À surveiller" || hotel.status === "Critique";
    case "Non scannés":
      return hotel.status === "Aucun scan";
    case "Erreur":
      // Aucun statut d'erreur n'existe encore dans le mock — sera réel une fois
      // le moteur de scan branché (Phase D, ScanHotelStatus.FAILED).
      return false;
  }
}

export function CrmHealth() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("Tous");

  const filtered = useMemo(
    () => hotels.filter((h) => h.name.toLowerCase().includes(search.toLowerCase()) && matchesFilter(h, filter)),
    [search, filter]
  );

  const realHotelsQuery = useQuery({ queryKey: ["hotels"], queryFn: api.listRealHotels });

  return (
    <div>
      <h1 className="text-2xl">CRM Health</h1>
      <p className="mt-1 text-sm text-graphite-soft">Diagnostic CRM de l'ensemble des hôtels auxquels vous avez accès.</p>

      {realHotelsQuery.data && realHotelsQuery.data.length > 0 && (
        <Card className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            Hôtels branchés sur des données réelles
            <span className="rounded-full bg-horizon-soft px-2 py-0.5 text-xs font-medium text-horizon-ink">vertical slice Phase C</span>
          </div>
          <div className="flex flex-col divide-y divide-graphite/10">
            {realHotelsQuery.data.map((hotel) => (
              <Link key={hotel.id} to={`/crm-health/${hotel.id}`} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 hover:opacity-80">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linen-deep text-graphite-soft"><Icon.Building width={15} height={15} /></div>
                  <div className="text-sm font-medium">{hotel.name}</div>
                </div>
                <Icon.ChevronRight width={14} height={14} className="text-graphite-faint" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card className="mt-4">
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
          <div className="flex rounded-lg border border-graphite/15 p-0.5 text-sm">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 ${f === filter ? "bg-terracotta text-white" : "text-graphite-soft hover:bg-linen-deep"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <DateRangeControl />
        </div>

        <HotelsTable hotels={filtered} showPortfolio />
      </Card>
    </div>
  );
}
