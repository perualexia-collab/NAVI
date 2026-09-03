import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth-context.js";
import { Card, CardHeader } from "../components/ui/Card.js";
import { ScoreRing } from "../components/ui/ScoreRing.js";
import { Modal } from "../components/ui/Modal.js";
import { Icon } from "../components/ui/icons.js";
import { formatDateTime, formatNumber } from "../lib/format.js";
import { api } from "../lib/api.js";
import type { RealDashboardOpportunity, RealDashboardSignalItem } from "../lib/real-hotel-types.js";

const OPPORTUNITY_PLAYBOOK_LABEL: Record<string, string> = {
  P06: "Fidélisation à activer",
  P09: "Potentiel fidélisation inexploité",
  P11: "Base CRM sous-exploitée"
};

export function Home() {
  const { user } = useAuth();
  const firstName = user?.name.split(" ")[0] ?? "";
  const [opportunitiesOpen, setOpportunitiesOpen] = useState(false);
  const [signalModal, setSignalModal] = useState<"alerts" | "vigilances" | "both" | null>(null);

  const dashboardQuery = useQuery({ queryKey: ["dashboard"], queryFn: api.getDashboard });
  const portfoliosQuery = useQuery({ queryKey: ["portfolios"], queryFn: api.listPortfolios });
  const dashboard = dashboardQuery.data;

  return (
    <div>
      <div>
        <h1 className="text-2xl">Bienvenue {firstName} 👋</h1>
        <p className="mt-1 text-sm text-graphite-soft">Voici la santé CRM de votre portefeuille aujourd'hui.</p>
      </div>

      {dashboardQuery.isLoading && <Card className="mt-6"><p className="text-sm text-graphite-faint">Chargement…</p></Card>}
      {dashboardQuery.isError && <Card className="mt-6"><p className="text-sm text-alert">Impossible de charger le tableau de bord.</p></Card>}

      {dashboard && (
        <>
          <div className="mt-6 grid grid-cols-4 gap-4">
            <StatTile icon={<Icon.Briefcase />} label="PORTEFEUILLES" value={dashboard.portfolioCount} caption="portefeuilles actifs" />
            <StatTile icon={<Icon.Building />} label="HÔTELS" value={dashboard.hotelCount} caption="hôtels au total" />
            <StatTile
              icon={<Icon.Activity />}
              label="SCANS RÉCENTS"
              value={dashboard.recentlyScannedCount}
              caption="hôtels scannés au cours des 30 derniers jours"
            />
            <Card className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-graphite-faint">SANTÉ CRM MOYENNE</div>
                <div className="mt-3 font-display text-2xl font-semibold tabular-nums">
                  {dashboard.averageHealthScore !== null ? `${dashboard.averageHealthScore}/100` : "—"}
                </div>
                <div className="mt-1 text-xs text-graphite-faint">
                  {dashboard.averageHealthScore !== null ? "Basé sur le dernier scan de chaque hôtel" : "Aucun scan disponible"}
                </div>
              </div>
              <ScoreRing score={dashboard.averageHealthScore} size={72} strokeWidth={6} />
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <Card>
              <CardHeader
                icon={<Icon.AlertTriangle className="text-warn" />}
                title="À surveiller"
                action={
                  <button type="button" onClick={() => setSignalModal("both")} className="text-xs text-terracotta hover:underline">
                    Voir tout
                  </button>
                }
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-alert-soft p-3">
                  <div className="font-display text-xl font-semibold text-alert-ink">{dashboard.criticalAlerts}</div>
                  <div className="text-xs text-graphite-soft">Alertes critiques<br />nécessitent votre attention</div>
                  <button type="button" onClick={() => setSignalModal("alerts")} className="mt-2 inline-block text-xs font-medium text-alert hover:underline">
                    Voir les alertes →
                  </button>
                </div>
                <div className="rounded-lg bg-warn-soft p-3">
                  <div className="font-display text-xl font-semibold text-warn-ink">{dashboard.vigilances}</div>
                  <div className="text-xs text-graphite-soft">Vigilances<br />à surveiller</div>
                  <button type="button" onClick={() => setSignalModal("vigilances")} className="mt-2 inline-block text-xs font-medium text-warn hover:underline">
                    Voir les vigilances →
                  </button>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                icon={<Icon.Star className="text-terracotta" />}
                title="Opportunités détectées"
                action={
                  <button type="button" onClick={() => setOpportunitiesOpen(true)} className="text-xs text-terracotta hover:underline">
                    Voir toutes
                  </button>
                }
              />
              <div className="flex items-end justify-between">
                <div>
                  <div className="font-display text-xl font-semibold">{dashboard.opportunityCount} opportunités</div>
                  <div className="text-xs text-graphite-soft">{formatNumber(dashboard.potentialClients)} clients potentiels</div>
                </div>
                <SignalBarChart breakdown={{ alert: dashboard.criticalAlerts, vigilance: dashboard.vigilances, opportunity: dashboard.opportunityCount }} />
              </div>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <Card>
              <CardHeader icon={<Icon.Clock className="text-graphite-soft" />} title="Activité récente" />
              {dashboard.recentScans.length === 0 ? (
                <p className="text-sm text-graphite-faint">Aucun scan pour l'instant.</p>
              ) : (
                <div className="flex flex-col divide-y divide-graphite/10">
                  {dashboard.recentScans.map((scan) => (
                    <Link key={scan.hotelId} to={`/crm-health/${scan.hotelId}`} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 hover:opacity-80">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linen-deep text-graphite-soft"><Icon.Building width={15} height={15} /></div>
                        <div>
                          <div className="text-sm font-medium">Scan terminé – {scan.hotelName}</div>
                          <div className="text-xs text-graphite-faint">{formatDateTime(scan.scannedAt)}</div>
                        </div>
                      </div>
                      {scan.healthScore !== null && <ScorePill score={scan.healthScore} />}
                    </Link>
                  ))}
                </div>
              )}
              <Link to="/crm-health" className="mt-3 inline-block text-xs font-medium text-terracotta hover:underline">Voir tous les scans →</Link>
            </Card>

            <Card>
              <CardHeader icon={<Icon.Briefcase className="text-graphite-soft" />} title="Santé CRM par portefeuille" />
              {portfoliosQuery.isLoading && <p className="text-sm text-graphite-faint">Chargement…</p>}
              {(portfoliosQuery.data?.length ?? 0) === 0 && !portfoliosQuery.isLoading ? (
                <p className="text-sm text-graphite-faint">
                  Aucun portefeuille pour l'instant — crée-en un depuis "Mes portefeuilles".
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {portfoliosQuery.data?.map((p) => (
                    <Link key={p.id} to="/portefeuilles" className="rounded-lg border border-graphite/10 p-3 hover:border-terracotta/40">
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-graphite-faint">{p.hotels.length} hôtels</div>
                      <div className="mt-2 flex items-center gap-2">
                        <ScoreRing score={p.health.healthScore} size={52} strokeWidth={5} />
                        {p.health.criticalCount > 0 && <span className="text-xs font-medium text-alert">{p.health.criticalCount} critique{p.health.criticalCount > 1 ? "s" : ""}</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Link to="/portefeuilles" className="mt-3 inline-block text-xs font-medium text-terracotta hover:underline">Voir tous les portefeuilles →</Link>
            </Card>
          </div>
        </>
      )}

      {opportunitiesOpen && dashboard && <OpportunitiesModal opportunities={dashboard.opportunities} onClose={() => setOpportunitiesOpen(false)} />}

      {signalModal && dashboard && (
        <SignalListModal
          title={signalModal === "alerts" ? "Alertes critiques" : signalModal === "vigilances" ? "Vigilances" : "À surveiller"}
          items={
            signalModal === "alerts"
              ? dashboard.alertItems.map((item) => ({ ...item, kind: "alert" as const }))
              : signalModal === "vigilances"
                ? dashboard.vigilanceItems.map((item) => ({ ...item, kind: "vigilance" as const }))
                : [
                    ...dashboard.alertItems.map((item) => ({ ...item, kind: "alert" as const })),
                    ...dashboard.vigilanceItems.map((item) => ({ ...item, kind: "vigilance" as const }))
                  ]
          }
          onClose={() => setSignalModal(null)}
        />
      )}
    </div>
  );
}

function OpportunitiesModal({ opportunities, onClose }: { opportunities: RealDashboardOpportunity[]; onClose: () => void }) {
  return (
    <Modal title="Opportunités détectées" onClose={onClose} wide>
      {opportunities.length === 0 ? (
        <p className="text-sm text-graphite-faint">Aucune opportunité détectée sur les derniers scans.</p>
      ) : (
        <div className="flex flex-col divide-y divide-graphite/10">
          {opportunities.map((opportunity, index) => (
            <Link
              key={`${opportunity.hotelId}-${opportunity.playbookId}-${index}`}
              to={`/crm-health/${opportunity.hotelId}`}
              onClick={onClose}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:opacity-80"
            >
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  {opportunity.priority === "high" && <span title="Prioritaire">⭐</span>}
                  {opportunity.hotelName}
                  <span className="text-xs font-normal text-graphite-faint">— {OPPORTUNITY_PLAYBOOK_LABEL[opportunity.playbookId] ?? opportunity.name}</span>
                </div>
                <div className="text-xs text-graphite-faint">
                  {opportunity.recipients !== null
                    ? `${opportunity.detailLabel ? `${opportunity.detailLabel} — ` : ""}${formatNumber(opportunity.recipients)} clients potentiels`
                    : opportunity.detailLabel}
                </div>
              </div>
              {opportunity.priority === "high" && (
                <span className="whitespace-nowrap rounded-full bg-terracotta-soft px-2 py-0.5 text-xs font-medium text-terracotta-ink">Prioritaire</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </Modal>
  );
}

const SIGNAL_KIND_STYLE = { alert: "bg-alert-soft text-alert-ink", vigilance: "bg-warn-soft text-warn-ink" } as const;
const SIGNAL_KIND_LABEL = { alert: "Alerte", vigilance: "Vigilance" } as const;

function SignalListModal({
  title,
  items,
  onClose
}: {
  title: string;
  items: (RealDashboardSignalItem & { kind: "alert" | "vigilance" })[];
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose} wide>
      {items.length === 0 ? (
        <p className="text-sm text-graphite-faint">Rien à signaler sur les derniers scans.</p>
      ) : (
        <div className="flex flex-col divide-y divide-graphite/10">
          {items.map((item, index) => (
            <Link
              key={`${item.hotelId}-${item.playbookId}-${index}`}
              to={`/crm-health/${item.hotelId}`}
              onClick={onClose}
              className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:opacity-80"
            >
              <div>
                <div className="text-sm font-medium">
                  {item.hotelName} <span className="font-normal text-graphite-faint">— {item.name}</span>
                </div>
                <div className="text-xs text-graphite-faint">{item.trigger}</div>
                {item.detailLabel && <div className="mt-0.5 text-xs text-graphite-soft">{item.detailLabel}</div>}
              </div>
              <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${SIGNAL_KIND_STYLE[item.kind]}`}>
                {SIGNAL_KIND_LABEL[item.kind]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Modal>
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
  const max = Math.max(breakdown.alert, breakdown.vigilance, breakdown.opportunity, 1);
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
