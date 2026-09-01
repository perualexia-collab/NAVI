import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { getHotel } from "../mock/data.js";
import { DateRangeControl } from "../components/ui/DateRangeControl.js";
import { StarRating } from "../components/ui/StarRating.js";
import { Icon } from "../components/ui/icons.js";
import { formatDateTime } from "../lib/format.js";
import { OverviewTab } from "../features/crm-health/OverviewTab.js";
import { IndicatorsTab } from "../features/crm-health/IndicatorsTab.js";
import { SignalsTab } from "../features/crm-health/SignalsTab.js";
import { AudiencesTab } from "../features/crm-health/AudiencesTab.js";
import { ScanHistoryTab } from "../features/crm-health/ScanHistoryTab.js";

const TABS = [
  "Vue d'ensemble",
  "Indicateurs",
  "Alertes",
  "Vigilances",
  "Opportunités",
  "Audiences",
  "Historique des scans"
] as const;
type Tab = (typeof TABS)[number];

export function CrmHealthHotel() {
  const { hotelId } = useParams<{ hotelId: string }>();
  const [tab, setTab] = useState<Tab>("Vue d'ensemble");
  const hotel = hotelId ? getHotel(hotelId) : undefined;

  if (!hotel) return <Navigate to="/crm-health" replace />;

  return (
    <div>
      <div className="mb-4 text-xs text-graphite-faint">
        <Link to="/" className="hover:underline">Accueil</Link> <span className="mx-1">›</span>
        <Link to="/crm-health" className="hover:underline">CRM Health</Link> <span className="mx-1">›</span>
        <span className="text-graphite-soft">{hotel.name}</span>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-linen-deep text-graphite-soft">
            <Icon.Building width={20} height={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl">{hotel.name}</h1>
              <StarRating value={hotel.starRating} />
            </div>
            <p className="text-sm text-graphite-faint">{hotel.portfolioName} • {hotel.city}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <DateRangeControl />
            <button className="flex items-center gap-1.5 rounded-lg bg-sage px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              <Icon.Play width={14} height={14} /> Lancer un nouveau scan
            </button>
          </div>
          {hotel.lastScanAt && (
            <div className="flex items-center gap-1 text-xs text-graphite-faint">
              <Icon.RefreshCw width={12} height={12} /> Dernier scan : {formatDateTime(hotel.lastScanAt)}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-1 border-b border-graphite/10">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm ${
              tab === t ? "border-terracotta font-medium text-terracotta" : "border-transparent text-graphite-soft hover:text-graphite"
            }`}
          >
            {t}
            {t === "Alertes" && hotel.alerts !== null && <Count value={hotel.alerts} />}
            {t === "Vigilances" && hotel.vigilances !== null && <Count value={hotel.vigilances} />}
            {t === "Opportunités" && hotel.opportunities !== null && <Count value={hotel.opportunities} />}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "Vue d'ensemble" && <OverviewTab hotel={hotel} />}
        {tab === "Indicateurs" && <IndicatorsTab hotel={hotel} />}
        {tab === "Alertes" && <SignalsTab severity="ALERT" />}
        {tab === "Vigilances" && <SignalsTab severity="VIGILANCE" />}
        {tab === "Opportunités" && <SignalsTab severity="OPPORTUNITY" />}
        {tab === "Audiences" && <AudiencesTab />}
        {tab === "Historique des scans" && <ScanHistoryTab />}
      </div>
    </div>
  );
}

function Count({ value }: { value: number }) {
  return <span className="ml-1 rounded-full bg-linen-deep px-1.5 py-0.5 text-[10px] text-graphite-soft">{value}</span>;
}
