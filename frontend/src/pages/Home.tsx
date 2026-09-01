import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth-context.js";
import { Card, CardHeader } from "../components/ui/Card.js";
import { ScoreRing } from "../components/ui/ScoreRing.js";
import { TrendLabel } from "../components/ui/StatusPill.js";
import { DateRangeControl } from "../components/ui/DateRangeControl.js";
import { Icon } from "../components/ui/icons.js";
import { formatDateTime, formatNumber } from "../lib/format.js";
import { homeStats, portfolios, recentScans } from "../mock/data.js";

export function Home() {
  const { user } = useAuth();
  const firstName = user?.name.split(" ")[0] ?? "";

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl">Bienvenue {firstName} 👋</h1>
          <p className="mt-1 text-sm text-graphite-soft">Voici la santé CRM de votre portefeuille aujourd'hui.</p>
        </div>
        <DateRangeControl />
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4">
        <StatTile icon={<Icon.Briefcase />} label="PORTEFEUILLES" value={homeStats.portfolioCount} caption="portefeuilles actifs" />
        <StatTile icon={<Icon.Building />} label="HÔTELS" value={homeStats.hotelCount} caption="hôtels au total" />
        <StatTile
          icon={<Icon.Activity />}
          label="SCANS RÉCENTS"
          value={homeStats.recentlyScannedCount}
          caption="hôtels scannés au cours des 30 derniers jours"
        />
        <Card className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-graphite-faint">SANTÉ CRM MOYENNE</div>
            <div className="mt-3 font-display text-2xl font-semibold tabular-nums">{homeStats.averageHealthScore}/100</div>
            <div className="mt-1"><TrendLabel delta={homeStats.averageHealthDelta} /></div>
          </div>
          <ScoreRing score={homeStats.averageHealthScore} size={52} strokeWidth={5} />
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card>
          <CardHeader icon={<Icon.AlertTriangle className="text-warn" />} title="À surveiller" action={<Link to="/crm-health" className="text-xs text-terracotta hover:underline">Voir tout</Link>} />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-alert-soft p-3">
              <div className="font-display text-xl font-semibold text-alert-ink">{homeStats.criticalAlerts}</div>
              <div className="text-xs text-graphite-soft">Alertes critiques<br />nécessitent votre attention</div>
              <Link to="/crm-health" className="mt-2 inline-block text-xs font-medium text-alert hover:underline">Voir les alertes →</Link>
            </div>
            <div className="rounded-lg bg-warn-soft p-3">
              <div className="font-display text-xl font-semibold text-warn-ink">{homeStats.vigilances}</div>
              <div className="text-xs text-graphite-soft">Vigilances<br />à surveiller</div>
              <Link to="/crm-health" className="mt-2 inline-block text-xs font-medium text-warn hover:underline">Voir les vigilances →</Link>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Icon.Star className="text-terracotta" />} title="Opportunités détectées" action={<Link to="/crm-health" className="text-xs text-terracotta hover:underline">Voir toutes</Link>} />
          <div className="flex items-end justify-between">
            <div>
              <div className="font-display text-xl font-semibold">{homeStats.opportunityCount} opportunités</div>
              <div className="text-xs text-graphite-soft">{formatNumber(homeStats.potentialClients)} clients potentiels</div>
            </div>
            <SignalBarChart breakdown={homeStats.signalBreakdown} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card>
          <CardHeader icon={<Icon.Clock className="text-graphite-soft" />} title="Activité récente" />
          <div className="flex flex-col divide-y divide-graphite/10">
            {recentScans.map((scan) => (
              <Link key={scan.hotelId} to={`/crm-health/${scan.hotelId}`} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 hover:opacity-80">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linen-deep text-graphite-soft"><Icon.Building width={15} height={15} /></div>
                  <div>
                    <div className="text-sm font-medium">Scan terminé – {scan.hotelName}</div>
                    <div className="text-xs text-graphite-faint">{formatDateTime(scan.scannedAt)}</div>
                  </div>
                </div>
                <ScorePill score={scan.healthScore} />
              </Link>
            ))}
          </div>
          <Link to="/crm-health" className="mt-3 inline-block text-xs font-medium text-terracotta hover:underline">Voir tous les scans →</Link>
        </Card>

        <Card>
          <CardHeader icon={<Icon.Briefcase className="text-graphite-soft" />} title="Santé CRM par portefeuille" />
          <div className="grid grid-cols-2 gap-3">
            {portfolios.map((p) => (
              <Link key={p.id} to="/portefeuilles" className="rounded-lg border border-graphite/10 p-3 hover:border-terracotta/40">
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-graphite-faint">{p.hotelCount} hôtels</div>
                <div className="mt-2 flex items-center gap-2">
                  <ScoreRing score={p.healthScore} size={38} strokeWidth={4} />
                  <TrendLabel delta={p.healthDelta} />
                </div>
              </Link>
            ))}
          </div>
          <Link to="/portefeuilles" className="mt-3 inline-block text-xs font-medium text-terracotta hover:underline">Voir tous les portefeuilles →</Link>
        </Card>
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, caption }: { icon: React.ReactNode; label: string; value: number; caption: string }) {
  return (
    <Card className="flex items-center justify-between">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-graphite-faint">{label}</div>
        <div className="mt-3 font-display text-2xl font-semibold tabular-nums">{value}</div>
        <div className="mt-1 text-xs text-graphite-soft">{caption}</div>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linen-deep text-graphite-soft">{icon}</div>
    </Card>
  );
}

function ScorePill({ score }: { score: number }) {
  const tone = score >= 75 ? "bg-sage-soft text-sage-ink" : score >= 60 ? "bg-warn-soft text-warn-ink" : "bg-alert-soft text-alert-ink";
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${tone}`}>{score}/100</span>;
}

function SignalBarChart({ breakdown }: { breakdown: { alert: number; vigilance: number; opportunity: number } }) {
  const max = Math.max(breakdown.alert, breakdown.vigilance, breakdown.opportunity);
  const bars = [
    { label: "Alerte", value: breakdown.alert, color: "bg-alert" },
    { label: "Vigilance", value: breakdown.vigilance, color: "bg-warn" },
    { label: "Opportunité", value: breakdown.opportunity, color: "bg-sage" }
  ];
  return (
    <div className="flex items-end gap-3">
      {bars.map((bar) => (
        <div key={bar.label} className="flex flex-col items-center gap-1">
          <span className="text-xs font-medium tabular-nums">{bar.value}</span>
          <div className="flex h-16 w-6 items-end rounded bg-linen-deep">
            <div className={`w-full rounded ${bar.color}`} style={{ height: `${(bar.value / max) * 100}%` }} />
          </div>
          <span className="text-[10px] text-graphite-faint">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}
