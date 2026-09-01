import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader } from "../../components/ui/Card.js";
import { ScoreRing } from "../../components/ui/ScoreRing.js";
import { Icon } from "../../components/ui/icons.js";
import { formatDateTime } from "../../lib/format.js";
import { api, ApiError } from "../../lib/api.js";
import type { RealHotel, RealScanSummary, ScanPeriodValue } from "../../lib/real-hotel-types.js";

const STEP_LABEL: Record<string, string> = {
  BASE: "Base exploitable",
  CAPTURE: "Captation e-mail",
  OTA: "Dépendance OTA",
  RETURNING: "Returning Guests",
  MARKETING: "Statistiques Marketing"
};

const SEVERITY_LABEL: Record<string, string> = { ALERT: "Alerte", VIGILANCE: "Vigilance", OPPORTUNITY: "Opportunité" };
const SEVERITY_STYLE: Record<string, string> = {
  ALERT: "bg-alert-soft text-alert-ink",
  VIGILANCE: "bg-warn-soft text-warn-ink",
  OPPORTUNITY: "bg-sage-soft text-sage-ink"
};

/**
 * Vue "premier vertical slice réel" — brief §49. Contrairement à la fiche
 * mockée (OverviewTab.tsx), chaque donnée affichée ici vient réellement de
 * PostgreSQL, alimentée par un vrai scan Playwright. Règles strictes
 * (arbitrages du 2026-09-01) :
 *  - uniquement les KPI du catalogue réel, uniquement s'ils ont été
 *    effectivement récupérés (available: true) ;
 *  - aucune évolution / comparaison temporelle inventée : "Première
 *    analyse" tant qu'il n'existe pas assez de scans réels.
 */
export function RealHotelOverview({ hotel }: { hotel: RealHotel }) {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<ScanPeriodValue>("last12Months");

  const healthQuery = useQuery({
    queryKey: ["hotel-health", hotel.id],
    queryFn: () => api.getHotelHealth(hotel.id)
  });

  const scanMutation = useMutation({
    mutationFn: () => api.launchScan(hotel.id, period),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hotel-health", hotel.id] })
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <select value={period} onChange={(e) => setPeriod(e.target.value as ScanPeriodValue)} className="rounded-lg border border-graphite/15 bg-linen px-3 py-2">
            <option value="last3Months">3 derniers mois</option>
            <option value="last6Months">6 derniers mois</option>
            <option value="last12Months">12 derniers mois</option>
          </select>
          <button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-sage px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Icon.Play width={14} height={14} /> {scanMutation.isPending ? "Scan en cours — Expérience…" : "Lancer un nouveau scan"}
          </button>
        </div>
      </div>

      {scanMutation.isPending && (
        <div className="mb-4 rounded-lg bg-horizon-soft px-3 py-2 text-sm text-horizon-ink">
          Connexion à Expérience et collecte des KPI en cours — peut prendre plusieurs minutes. Ne ferme pas cette page.
        </div>
      )}

      {scanMutation.isError && (
        <div className="mb-4 rounded-lg bg-alert-soft px-3 py-2 text-sm text-alert-ink">
          {scanMutation.error instanceof ApiError ? scanMutation.error.message : "Le scan a échoué."}
        </div>
      )}

      {healthQuery.isLoading && <Card><p className="text-sm text-graphite-faint">Chargement…</p></Card>}

      {healthQuery.isError && (
        <Card><p className="text-sm text-alert">Impossible de charger l'état CRM de cet hôtel.</p></Card>
      )}

      {healthQuery.data && !healthQuery.data.latestScan && (
        <Card>
          <p className="text-sm text-graphite-soft">
            Aucun scan disponible pour {hotel.name}. Lance une première analyse pour voir apparaître son état CRM.
          </p>
        </Card>
      )}

      {healthQuery.data?.latestScan && (
        <ScanResult scan={healthQuery.data.latestScan} scanCount={healthQuery.data.scanCount} />
      )}
    </div>
  );
}

function ScanResult({ scan, scanCount }: { scan: RealScanSummary; scanCount: number }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-graphite-faint">Santé CRM globale</div>
          <div className="mt-3 flex items-center gap-3">
            <ScoreRing score={scan.healthScore} size={60} strokeWidth={5} />
            <div className="text-sm">
              {scan.healthScore !== null ? (
                <span className="rounded-full bg-sage-soft px-2 py-0.5 text-xs font-medium text-sage-ink">{scan.healthLevel}</span>
              ) : (
                <span className="text-xs text-graphite-faint">Non calculée — données partielles</span>
              )}
            </div>
          </div>
        </Card>
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-graphite-faint">Statut du scan</div>
          <div className="mt-3"><ScanStatusPill status={scan.status} /></div>
        </Card>
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-graphite-faint">Dernier scan</div>
          <div className="mt-3 flex items-center gap-2 text-sm"><Icon.Clock className="text-graphite-faint" width={16} height={16} /> {formatDateTime(scan.startedAt)}</div>
        </Card>
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-graphite-faint">Évolution</div>
          <div className="mt-3 text-sm text-graphite-faint">
            {scanCount < 2 ? "Première analyse — historique insuffisant" : "Comparaison temporelle : Phase D/E"}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader icon={<Icon.Activity className="text-graphite-faint" width={15} height={15} />} title="Détail du scan par étape" />
        <div className="grid grid-cols-5 gap-3">
          {scan.steps.map((step) => (
            <div key={step.name} className="rounded-lg border border-graphite/10 p-2.5 text-center">
              <div className="text-xs text-graphite-faint">{STEP_LABEL[step.name]}</div>
              <div className={`mt-1 text-sm font-medium ${step.status === "OK" ? "text-sage" : step.status === "ERROR" ? "text-alert" : "text-graphite-faint"}`}>
                {step.status === "OK" ? "✓ Récupéré" : step.status === "ERROR" ? "✕ Échec" : step.status}
              </div>
            </div>
          ))}
        </div>
        {scan.errors.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {scan.errors.map((error) => (
              <div key={error.stepName} className="rounded-lg bg-alert-soft px-3 py-2 text-xs text-alert-ink">
                {error.userMessage}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader icon={<Icon.Info className="text-graphite-faint" width={15} height={15} />} title="Indicateurs récupérés" />
        {scan.kpiResults.filter((k) => k.available).length === 0 ? (
          <p className="text-sm text-graphite-faint">Aucun indicateur récupéré sur ce scan.</p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {scan.kpiResults
              .filter((k) => k.available)
              .map((kpi) => (
                <div key={kpi.kpiDefinitionId} className="rounded-lg border border-graphite/10 p-2.5">
                  <div className="text-[11px] text-graphite-faint">{kpi.label}</div>
                  <div className="font-display text-sm font-semibold tabular-nums">{kpi.value ?? "—"}</div>
                  {!kpi.dateFilterable && <div className="mt-1 text-[10px] text-graphite-faint">Année N vs N-1 (non filtrable par période)</div>}
                </div>
              ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader icon={<Icon.AlertTriangle className="text-graphite-faint" width={15} height={15} />} title="Signaux détectés" />
        {scan.signalResults.length === 0 ? (
          <p className="text-sm text-graphite-faint">
            {scan.status === "SUCCESS" ? "Aucun signal détecté sur ce scan." : "Signaux non calculés — le scan n'a pas récupéré toutes les données nécessaires."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {scan.signalResults.map((signal) => (
              <div key={signal.playbookId} className="rounded-lg border border-graphite/10 p-3">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLE[signal.severity]}`}>{SEVERITY_LABEL[signal.severity]}</span>
                <div className="mt-1 text-sm font-medium">{signal.name}</div>
                <div className="text-xs text-graphite-faint">{signal.trigger}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ScanStatusPill({ status }: { status: string }) {
  const style =
    status === "SUCCESS" ? "bg-sage-soft text-sage-ink" : status === "PARTIAL_SUCCESS" ? "bg-warn-soft text-warn-ink" : "bg-alert-soft text-alert-ink";
  const label = status === "SUCCESS" ? "Réussi" : status === "PARTIAL_SUCCESS" ? "Partiel" : status === "FAILED" ? "Échoué" : status;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}
