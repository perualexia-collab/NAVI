import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui/Card.js";
import { DateRangeControl } from "../components/ui/DateRangeControl.js";
import { Icon } from "../components/ui/icons.js";
import { HotelsTable } from "../components/HotelsTable.js";
import type { MockHotel } from "../mock/types.js";
import { api } from "../lib/api.js";
import type { RealHotelListItem } from "../lib/real-hotel-types.js";

/** Filtres — brief §13, intitulés indicatifs. */
const FILTERS = ["Tous", "À surveiller", "Non scannés", "Erreur"] as const;
type Filter = (typeof FILTERS)[number];

function matchesFilter(hotel: MockHotel, filter: Filter): boolean {
  switch (filter) {
    case "Tous":
      return true;
    case "À surveiller":
      return hotel.status === "À surveiller" || hotel.status === "Critique";
    case "Non scannés":
      return hotel.status === "Aucun scan";
    case "Erreur":
      return hotel.status === "Erreur";
  }
}

// Même regroupement que Portfolios.tsx (statusFromHealthLevel), plus le
// cas "Erreur" — possible ici seulement parce qu'on a le statut brut du
// scan (scanStatus), pas seulement le niveau de santé calculé.
function statusFromRealHotel(healthLevel: RealHotelListItem["healthLevel"], scanStatus: RealHotelListItem["scanStatus"]): MockHotel["status"] {
  if (scanStatus === "FAILED") return "Erreur";
  if (!healthLevel) return "Aucun scan";
  if (healthLevel === "Excellent") return "Excellent";
  if (healthLevel === "Bon" || healthLevel === "Correct") return "Sain";
  if (healthLevel === "Fragile") return "À surveiller";
  return "Critique";
}

function toMockHotel(hotel: RealHotelListItem): MockHotel {
  return {
    id: hotel.id,
    name: hotel.name,
    portfolioId: "",
    portfolioName: hotel.portfolioNames.length > 0 ? hotel.portfolioNames.join(", ") : "—",
    lastScanAt: hotel.lastScanAt,
    healthScore: hotel.healthScore,
    healthLevel: hotel.healthLevel,
    alerts: hotel.alerts,
    vigilances: hotel.vigilances,
    opportunities: hotel.opportunities,
    status: statusFromRealHotel(hotel.healthLevel, hotel.scanStatus)
  };
}

export function CrmHealth() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("Tous");

  const realHotelsQuery = useQuery({ queryKey: ["hotels-overview"], queryFn: api.getHotelsOverview });

  // Uniquement les hôtels réels (NAVI/Playwright) — retours réels
  // 2026-09-03 : les hôtels de démonstration mockés n'ont plus leur place
  // ici, ils ne représentent aucune donnée exploitable.
  const allHotels = useMemo<MockHotel[]>(() => (realHotelsQuery.data ?? []).map(toMockHotel), [realHotelsQuery.data]);

  const filtered = useMemo(
    () => allHotels.filter((h) => h.name.toLowerCase().includes(search.toLowerCase()) && matchesFilter(h, filter)),
    [allHotels, search, filter]
  );

  return (
    <div>
      <h1 className="text-2xl">CRM Health</h1>
      <p className="mt-1 text-sm text-graphite-soft">Diagnostic CRM de l'ensemble des hôtels auxquels vous avez accès.</p>

      <Card className="mt-6">
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

        {realHotelsQuery.isError && <p className="mb-3 text-sm text-alert">Impossible de charger la liste des hôtels.</p>}

        <HotelsTable hotels={filtered} showPortfolio />
      </Card>
    </div>
  );
}
