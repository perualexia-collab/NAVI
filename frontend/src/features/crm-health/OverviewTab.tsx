import { Link } from "react-router-dom";
import type { MockHotel } from "../../mock/types.js";
import { Card, CardHeader } from "../../components/ui/Card.js";
import { ScoreRing } from "../../components/ui/ScoreRing.js";
import { TrendLabel } from "../../components/ui/StatusPill.js";
import { Icon } from "../../components/ui/icons.js";
import { formatCurrency, formatNumber } from "../../lib/format.js";
import { galileoBusinessPerformance, galileoKpis, galileoOverview } from "../../mock/hotel-detail.js";

export function OverviewTab({ hotel }: { hotel: MockHotel }) {
  const hasFullDetail = hotel.id === "h-galileo";

  if (!hasFullDetail) {
    return <ReducedOverview hotel={hotel} />;
  }

  const o = galileoOverview;

  return (
    <div>
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-graphite-faint">Santé CRM globale</div>
          <div className="mt-3 flex items-center gap-3">
            <ScoreRing score={o.healthScore} size={60} strokeWidth={5} />
            <div>
              <span className="inline-block rounded-full bg-sage-soft px-2 py-0.5 text-xs font-medium text-sage-ink">{o.healthLevel}</span>
              <div className="mt-1"><TrendLabel delta={o.healthDelta} /></div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-graphite-faint">Position dans le portefeuille</div>
          <div className="mt-3 flex items-center gap-2">
            <Icon.Trophy className="text-terracotta" />
            <span className="font-display text-2xl font-semibold tabular-nums">{o.portfolioPosition.rank}/{o.portfolioPosition.total}</span>
          </div>
          <div className="mt-1"><TrendLabel delta={o.portfolioPosition.delta} /></div>
        </Card>
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-graphite-faint">Dernier scan</div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Icon.Clock className="text-graphite-faint" width={16} height={16} /> {o.lastScanAt}
          </div>
        </Card>
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-graphite-faint">Période analysée</div>
          <div className="mt-3 text-sm">{o.period.start} - {o.period.end}</div>
          <div className="text-xs text-graphite-faint">{o.period.months} mois</div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader icon={<Icon.Info className="text-graphite-faint" width={15} height={15} />} title="Indicateurs clés" action={<Link to="#" className="text-xs text-terracotta hover:underline">Voir tous les indicateurs →</Link>} />
          <div className="grid grid-cols-4 gap-3">
            {galileoKpis.map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-graphite/10 p-2.5">
                <div className="text-[11px] text-graphite-faint">{kpi.label}</div>
                <div className="font-display text-sm font-semibold">{kpi.value}</div>
                <div className={`text-[11px] font-medium ${kpi.trend === "down" ? "text-alert" : "text-sage"}`}>{kpi.delta}</div>
                <span className="mt-1 inline-block rounded bg-linen-deep px-1.5 py-0.5 text-[10px] text-graphite-soft">{kpi.status}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Icon.AlertTriangle className="text-graphite-faint" width={15} height={15} />} title="Diagnostic NAVI" action={<Link to="#" className="text-xs text-terracotta hover:underline">Voir tous les signaux →</Link>} />
          <div className="flex flex-col gap-2">
            <DiagnosticRow icon={<Icon.AlertTriangle className="text-alert" width={16} height={16} />} count={hotel.alerts ?? 0} label="Alertes" caption="Éléments critiques nécessitant votre action rapide." />
            <DiagnosticRow icon={<Icon.Eye className="text-warn" width={16} height={16} />} count={hotel.vigilances ?? 0} label="Vigilances" caption="Points à surveiller pour éviter une dégradation." />
            <DiagnosticRow icon={<Icon.Star className="text-sage" width={16} height={16} />} count={hotel.opportunities ?? 0} label="Opportunités" caption="Leviers identifiés pour améliorer vos performances." />
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader icon={<Icon.Activity className="text-graphite-faint" width={15} height={15} />} title="Performance business" />
        <div className="grid grid-cols-2 gap-6">
          <PerformanceBar label="CA généré" current={galileoBusinessPerformance.revenue.current} previous={galileoBusinessPerformance.revenue.previous} delta={galileoBusinessPerformance.revenue.delta} compareLabel={galileoBusinessPerformance.compareLabel} isCurrency />
          <PerformanceBar label="Réservations" current={galileoBusinessPerformance.bookings.current} previous={galileoBusinessPerformance.bookings.previous} delta={galileoBusinessPerformance.bookings.delta} compareLabel={galileoBusinessPerformance.compareLabel} />
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card>
          <CardHeader icon={<Icon.Info className="text-graphite-faint" width={15} height={15} />} title="Diagnostic du scan" />
          <p className="text-sm text-graphite-soft">
            Ce diagnostic est basé sur l'analyse de {o.kpiAnalyzed} indicateurs CRM et business. Les principaux enseignements de votre scan :
          </p>
          <button className="mt-3 text-sm font-medium text-terracotta hover:underline">Voir le diagnostic complet →</button>
        </Card>
        <Card>
          <CardHeader icon={<Icon.ThumbsUp className="text-sage" width={15} height={15} />} title="Points forts" />
          <ul className="flex flex-col gap-2 text-sm text-graphite-soft">
            {o.strengths.map((s) => <li key={s} className="flex gap-2"><span className="text-sage">✓</span>{s}</li>)}
          </ul>
        </Card>
        <Card>
          <CardHeader icon={<Icon.AlertTriangle className="text-warn" width={15} height={15} />} title="Points d'attention" />
          <ul className="flex flex-col gap-2 text-sm text-graphite-soft">
            {o.attentionPoints.map((s) => <li key={s} className="flex gap-2"><span className="text-warn">•</span>{s}</li>)}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function ReducedOverview({ hotel }: { hotel: MockHotel }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <Card>
        <div className="text-xs font-medium uppercase tracking-wide text-graphite-faint">Santé CRM globale</div>
        <div className="mt-3"><ScoreRing score={hotel.healthScore} size={60} strokeWidth={5} /></div>
      </Card>
      <Card><div className="text-xs uppercase text-graphite-faint">Alertes</div><div className="mt-2 font-display text-xl font-semibold">{hotel.alerts ?? "—"}</div></Card>
      <Card><div className="text-xs uppercase text-graphite-faint">Vigilances</div><div className="mt-2 font-display text-xl font-semibold">{hotel.vigilances ?? "—"}</div></Card>
      <Card><div className="text-xs uppercase text-graphite-faint">Opportunités</div><div className="mt-2 font-display text-xl font-semibold">{hotel.opportunities ?? "—"}</div></Card>
      <Card className="col-span-4">
        <p className="text-sm text-graphite-soft">
          Détail complet mocké disponible uniquement pour l'Hôtel Galileo à ce stade de la Phase B — les autres fiches
          afficheront le même niveau de détail une fois le premier flux réel branché (Phase C).
        </p>
      </Card>
    </div>
  );
}

function DiagnosticRow({ icon, count, label, caption }: { icon: React.ReactNode; count: number; label: string; caption: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-graphite/10 p-2.5">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium">{count} {label}</div>
        <div className="text-xs text-graphite-faint">{caption}</div>
      </div>
      <Icon.ChevronRight className="mt-1 text-graphite-faint" width={14} height={14} />
    </div>
  );
}

function PerformanceBar({ label, current, previous, delta, compareLabel, isCurrency }: { label: string; current: number; previous: number; delta: number; compareLabel: string; isCurrency?: boolean }) {
  const format = isCurrency ? formatCurrency : formatNumber;
  const max = Math.max(current, previous);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-graphite-faint">Comparer à : {compareLabel}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <BarRow year="2026 (8 mois)" value={current} max={max} format={format} color="bg-terracotta" />
        <BarRow year="2025 (8 mois)" value={previous} max={max} format={format} color="bg-linen-deep" textColor="text-graphite-soft" />
      </div>
      <div className="mt-1 text-xs font-medium text-sage">↑ +{delta} % vs période précédente</div>
    </div>
  );
}

function BarRow({ year, value, max, format, color, textColor = "text-white" }: { year: string; value: number; max: number; format: (n: number) => string; color: string; textColor?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-graphite-faint">{year}</span>
      <div className="h-5 flex-1 rounded bg-linen-deep">
        <div className={`flex h-5 items-center justify-end rounded px-2 ${color}`} style={{ width: `${(value / max) * 100}%` }}>
          <span className={`text-[11px] font-medium ${textColor}`}>{format(value)}</span>
        </div>
      </div>
    </div>
  );
}
