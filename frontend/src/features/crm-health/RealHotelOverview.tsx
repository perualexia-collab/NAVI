import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader } from "../../components/ui/Card.js";
import { ScoreRing } from "../../components/ui/ScoreRing.js";
import { scoreTone } from "../../components/ui/score-color.js";
import { periodLabel, RealPeriodSelector } from "../../components/ui/RealPeriodSelector.js";
import { Icon } from "../../components/ui/icons.js";
import { formatDateTime, formatNumber, formatCurrency } from "../../lib/format.js";
import { api, ApiError } from "../../lib/api.js";
import type { RealHotel, RealKpiResult, RealScanPeriod, RealScanSummary, RealAutomationStatus } from "../../lib/real-hotel-types.js";

/** P10 — le statut des automations bloque ou non la recherche de campagne ponctuelle (backend/experience/audience-builder/p10-automation-status.ts). */
function automationStatusMessage(status: RealAutomationStatus): string {
  switch (status.action) {
    case "ACTIVATE_AUTOMATIONS":
      return "Le pack d'automations marketing n'est pas activé — active-le avant de chercher une campagne ponctuelle.";
    case "FIX_AUTOMATION_CONFIGURATION":
      return "Le pack d'automations est partiellement configuré — corrige les automations inactives inattendues avant de proposer une campagne ponctuelle.";
    case "MANUAL_CHECK":
      return "Impossible de lire l'état des automations marketing — vérification manuelle nécessaire.";
    default:
      return "Statut des automations inconnu.";
  }
}

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

const HEALTH_LABEL_STYLE: Record<"sage" | "warn" | "alert" | "muted", string> = {
  sage: "bg-sage-soft text-sage-ink",
  warn: "bg-warn-soft text-warn-ink",
  alert: "bg-alert-soft text-alert-ink",
  muted: "bg-linen-deep text-graphite-faint"
};

// Retours réels Phase C (2026-09-02) : le catalogue KPI ne porte pas
// l'unité (référentiel Excel muet là-dessus pour ces lignes) — associée ici
// à l'affichage plutôt qu'inventée dans le référentiel métier.
const PERCENT_KPI_IDS = new Set([
  "emailCaptureRate",
  "otaAgencyEmailShare",
  "unsubscribedShare",
  "activabilityRate",
  "otaBookingReservationShare",
  "otaBookingRevenueShare",
  "otaExpediaReservationShare",
  "otaExpediaRevenueShare",
  "nonOtaReservationShare",
  "nonOtaRevenueShare",
  "returningGuestsRate"
]);
const CURRENCY_KPI_IDS = new Set(["crmRevenue", "automationRevenue", "campaignRevenue"]);
// Retiré de l'affichage sur demande (2026-09-02) — remplacé par
// "Taux d'activabilité" dans la grille ; toujours scrapé/persisté
// (audit/futur usage), juste pas montré ici.
const HIDDEN_KPI_IDS = new Set(["unsubscribedShare"]);

function formatKpiValue(kpiDefinitionId: string, value: number): string {
  if (PERCENT_KPI_IDS.has(kpiDefinitionId)) return `${formatNumber(value)}%`;
  if (CURRENCY_KPI_IDS.has(kpiDefinitionId)) return formatCurrency(value);
  return formatNumber(value);
}

function formatScanProgress(elapsedMs: number, averageMs: number | null): string {
  if (!averageMs) return "Cela peut prendre quelques minutes.";
  const remainingMs = averageMs - elapsedMs;
  if (remainingMs <= 1000) return "Ça ne devrait plus tarder…";
  return `Encore environ ${Math.round(remainingMs / 1000)}s (estimation basée sur les scans précédents).`;
}

/**
 * Vue "premier vertical slice réel" — brief §49. Contrairement à la fiche
 * mockée (OverviewTab.tsx), chaque donnée affichée ici vient réellement de
 * PostgreSQL, alimentée par un vrai scan Playwright. Règles strictes
 * (arbitrages du 2026-09-01) :
 *  - uniquement les KPI du catalogue réel, uniquement s'ils ont été
 *    effectivement récupérés (available: true) ;
 *  - aucune évolution / comparaison temporelle inventée : "Première
 *    analyse" tant qu'il n'existe pas assez de scans réels, et la
 *    comparaison N vs N-1 des KPI non filtrables n'est affichée que si le
 *    moteur l'a effectivement scrapée (previousValue/evolutionPoints).
 */
export function RealHotelOverview({ hotel }: { hotel: RealHotel }) {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<RealScanPeriod>({ mode: "preset", value: "last12Months" });
  const [elapsedMs, setElapsedMs] = useState(0);
  const scanStartRef = useRef<number | null>(null);

  const healthQuery = useQuery({
    queryKey: ["hotel-health", hotel.id],
    queryFn: () => api.getHotelHealth(hotel.id)
  });

  const scanMutation = useMutation({
    mutationFn: () => api.launchScan(hotel.id, period),
    onMutate: () => {
      scanStartRef.current = Date.now();
      setElapsedMs(0);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hotel-health", hotel.id] })
  });

  useEffect(() => {
    if (!scanMutation.isPending) return;
    const interval = setInterval(() => {
      if (scanStartRef.current) setElapsedMs(Date.now() - scanStartRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [scanMutation.isPending]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <RealPeriodSelector value={period} onChange={setPeriod} />
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
          Connexion à Expérience et collecte des KPI en cours — ne ferme pas cette page.{" "}
          {formatScanProgress(elapsedMs, healthQuery.data?.averageScanDurationMs ?? null)}
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
        <ScanResult scan={healthQuery.data.latestScan} hotelId={hotel.id} />
      )}
    </div>
  );
}

function ScanResult({ scan, hotelId }: { scan: RealScanSummary; hotelId: string }) {
  const tone = scoreTone(scan.healthScore);
  const queryClient = useQueryClient();

  // Phase E2 — "Calculer l'audience" : un seul calcul à la fois (même
  // session Expérience partagée que le scan), on suit donc quelle
  // recommandation est en cours plutôt qu'un simple isPending global.
  const [computingRecommendationId, setComputingRecommendationId] = useState<string | null>(null);
  const [audienceError, setAudienceError] = useState<{ recommendationId: string; message: string } | null>(null);
  const computeAudienceMutation = useMutation({
    mutationFn: (recommendationId: string) => api.computeAudience(hotelId, recommendationId),
    onMutate: (recommendationId: string) => {
      setComputingRecommendationId(recommendationId);
      setAudienceError(null);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hotel-health", hotelId] }),
    onError: (error: unknown, recommendationId: string) => {
      setAudienceError({ recommendationId, message: error instanceof ApiError ? error.message : "Le calcul de l'audience a échoué." });
    },
    onSettled: () => setComputingRecommendationId(null)
  });

  // Phase E3 — "Comparer les opportunités" (P11) : même contrainte que
  // ci-dessus (une seule session Expérience à la fois côté serveur) —
  // audienceActionRunning couvre les deux mutations pour désactiver tous
  // les boutons pendant qu'un calcul, quel qu'il soit, est en cours.
  const [comparingRecommendationId, setComparingRecommendationId] = useState<string | null>(null);
  const [comparisonError, setComparisonError] = useState<{ recommendationId: string; message: string } | null>(null);
  const compareOpportunitiesMutation = useMutation({
    mutationFn: (recommendationId: string) => api.compareOpportunities(hotelId, recommendationId),
    onMutate: (recommendationId: string) => {
      setComparingRecommendationId(recommendationId);
      setComparisonError(null);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hotel-health", hotelId] }),
    onError: (error: unknown, recommendationId: string) => {
      setComparisonError({ recommendationId, message: error instanceof ApiError ? error.message : "La comparaison des opportunités a échoué." });
    },
    onSettled: () => setComparingRecommendationId(null)
  });

  // Phase E3 — "Comparer les audiences" (P10) : le statut des automations
  // peut bloquer la recherche de campagne — ce n'est pas une erreur (la
  // requête réussit), donc traité à part d'audienceComparisonError.
  const [comparingAudiencesRecommendationId, setComparingAudiencesRecommendationId] = useState<string | null>(null);
  const [audienceComparisonError, setAudienceComparisonError] = useState<{ recommendationId: string; message: string } | null>(null);
  const [automationBlockedMessage, setAutomationBlockedMessage] = useState<{ recommendationId: string; message: string; unexpectedInactive: string[] } | null>(null);
  const compareAudiencesMutation = useMutation({
    mutationFn: (recommendationId: string) => api.compareAudiences(hotelId, recommendationId),
    onMutate: (recommendationId: string) => {
      setComparingAudiencesRecommendationId(recommendationId);
      setAudienceComparisonError(null);
      setAutomationBlockedMessage(null);
    },
    onSuccess: (result: Awaited<ReturnType<typeof api.compareAudiences>>, recommendationId: string) => {
      if (result.blocked) {
        setAutomationBlockedMessage({ recommendationId, message: automationStatusMessage(result.automationStatus), unexpectedInactive: result.automationStatus.unexpectedInactive });
      } else {
        queryClient.invalidateQueries({ queryKey: ["hotel-health", hotelId] });
      }
    },
    onError: (error: unknown, recommendationId: string) => {
      setAudienceComparisonError({ recommendationId, message: error instanceof ApiError ? error.message : "La comparaison des audiences a échoué." });
    },
    onSettled: () => setComparingAudiencesRecommendationId(null)
  });

  // Phase F1 — "Créer la liste dans Expérience" : même session Playwright
  // partagée que les actions ci-dessus, donc compte aussi dans
  // audienceActionRunning.
  const [creatingListRecommendationId, setCreatingListRecommendationId] = useState<string | null>(null);
  const [createListError, setCreateListError] = useState<{ recommendationId: string; message: string } | null>(null);
  const createListMutation = useMutation({
    mutationFn: (recommendationId: string) => api.createAudienceList(hotelId, recommendationId),
    onMutate: (recommendationId: string) => {
      setCreatingListRecommendationId(recommendationId);
      setCreateListError(null);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hotel-health", hotelId] }),
    onError: (error: unknown, recommendationId: string) => {
      setCreateListError({ recommendationId, message: error instanceof ApiError ? error.message : "La création de la liste a échoué." });
    },
    onSettled: () => setCreatingListRecommendationId(null)
  });

  const audienceActionRunning =
    computingRecommendationId !== null ||
    comparingRecommendationId !== null ||
    comparingAudiencesRecommendationId !== null ||
    creatingListRecommendationId !== null;

  // Choix d'une option comparée — écriture simple, pas de session
  // Expérience impliquée, donc indépendant de audienceActionRunning.
  const [choosingResultId, setChoosingResultId] = useState<string | null>(null);
  const chooseMutation = useMutation({
    mutationFn: ({ comparisonId, resultId }: { comparisonId: string; resultId: string }) => api.chooseAudienceComparisonResult(hotelId, comparisonId, resultId),
    onMutate: ({ resultId }: { comparisonId: string; resultId: string }) => setChoosingResultId(resultId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hotel-health", hotelId] }),
    onSettled: () => setChoosingResultId(null)
  });

  // Phase F1 — bouton "Créer la liste dans Expérience" (ou confirmation +
  // "Recréer" si déjà fait), factorisé car appelé depuis 3 zones du JSX
  // (SINGLE, comparaison P11, comparaison P10).
  function renderCreateListAction(recommendationId: string, exportedListName: string | null, exportedAt: string | null) {
    if (exportedListName) {
      return (
        <div className="mt-2 rounded-md bg-sage-soft px-2 py-1.5 text-xs text-sage-ink">
          ✅ Liste créée dans Expérience : <span className="font-medium">{exportedListName}</span>
          {exportedAt && ` — le ${formatDateTime(exportedAt)}`}
          <button
            type="button"
            onClick={() => createListMutation.mutate(recommendationId)}
            disabled={audienceActionRunning}
            className="ml-2 rounded-md border border-sage/30 px-2 py-0.5 text-xs font-medium text-sage-ink hover:bg-sage-soft/70 disabled:opacity-50"
          >
            {creatingListRecommendationId === recommendationId ? "…" : "Recréer"}
          </button>
        </div>
      );
    }

    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => createListMutation.mutate(recommendationId)}
          disabled={audienceActionRunning}
          className="rounded-md border border-graphite/20 px-2.5 py-1 text-xs font-medium text-graphite hover:bg-linen-deep disabled:opacity-50"
        >
          {creatingListRecommendationId === recommendationId ? "Création en cours — Expérience…" : "Créer la liste dans Expérience"}
        </button>
        {createListError?.recommendationId === recommendationId && (
          <div className="mt-1 text-xs text-alert">{createListError.message}</div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-4">
        <Card className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-graphite-faint">Santé CRM globale</div>
            <div className="mt-2 text-sm">
              {scan.healthScore !== null ? (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH_LABEL_STYLE[tone]}`}>{scan.healthLevel}</span>
              ) : (
                <span className="text-xs text-graphite-faint">Non calculée — données partielles</span>
              )}
            </div>
          </div>
          <ScoreRing score={scan.healthScore} size={76} strokeWidth={6} />
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
          <div className="text-xs font-medium uppercase tracking-wide text-graphite-faint">Période analysée</div>
          <div className="mt-3 text-sm text-graphite">{periodLabel(scan.period)}</div>
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
        {scan.kpiResults.filter((k) => k.available && !HIDDEN_KPI_IDS.has(k.kpiDefinitionId)).length === 0 ? (
          <p className="text-sm text-graphite-faint">Aucun indicateur récupéré sur ce scan.</p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {scan.kpiResults
              .filter((k) => k.available && !HIDDEN_KPI_IDS.has(k.kpiDefinitionId))
              .map((kpi) => (
                <KpiCard key={kpi.kpiDefinitionId} kpi={kpi} />
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
                {signal.recommendationText && (
                  <div className="mt-2 rounded-md bg-linen-deep p-2 text-xs text-graphite-soft">
                    <div>
                      <span className="font-medium text-graphite">Recommandation — </span>
                      {signal.recommendationText}
                    </div>

                    {signal.recommendationId && signal.audienceDefinitionId && (
                      <div className="mt-2">
                        {signal.audienceResult ? (
                          <span className="font-medium text-graphite">
                            👥 {formatNumber(signal.audienceResult.recipients)} destinataire(s) potentiel(s) — mesuré le{" "}
                            {formatDateTime(signal.audienceResult.measuredAt)}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => computeAudienceMutation.mutate(signal.recommendationId!)}
                            disabled={audienceActionRunning}
                            className="rounded-md bg-terracotta px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {computingRecommendationId === signal.recommendationId ? "Calcul en cours — Expérience…" : "Calculer l'audience"}
                          </button>
                        )}

                        {audienceError?.recommendationId === signal.recommendationId && (
                          <div className="mt-1 text-alert">{audienceError.message}</div>
                        )}

                        {/* Phase F1 — dispo dès qu'une audience a été calculée au moins une fois. */}
                        {signal.audienceResult && renderCreateListAction(signal.recommendationId, signal.exportedListName, signal.exportedAt)}
                      </div>
                    )}

                    {/* Phase E3 — P11 (Comparer les opportunités). */}
                    {signal.playbookId === "P11" && signal.recommendationId && (
                      <div className="mt-2">
                        {signal.comparison ? (
                          <div className="flex flex-col gap-1.5">
                            {signal.comparison.results.map((result) => (
                              <div
                                key={result.id}
                                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ${result.highlighted ? "bg-terracotta-soft" : "bg-linen"}`}
                              >
                                <div>
                                  <span className="font-medium text-graphite">
                                    {result.highlighted ? "⭐ " : ""}
                                    {result.name}
                                  </span>
                                  <span className="ml-2 text-graphite-faint">
                                    👥 {formatNumber(result.recipients)} — {result.level ?? "—"} ({result.totalScore ?? "—"}/100)
                                  </span>
                                </div>
                                {signal.comparison!.chosenResultId === result.id ? (
                                  <span className="whitespace-nowrap font-medium text-sage">✓ Choisie</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => chooseMutation.mutate({ comparisonId: signal.comparison!.id, resultId: result.id })}
                                    disabled={choosingResultId !== null}
                                    className="whitespace-nowrap rounded-md border border-graphite/20 px-2 py-1 text-xs font-medium text-graphite hover:bg-linen-deep disabled:opacity-50"
                                  >
                                    {choosingResultId === result.id ? "…" : "Choisir"}
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => compareOpportunitiesMutation.mutate(signal.recommendationId!)}
                              disabled={audienceActionRunning}
                              className="mt-1 self-start rounded-md border border-graphite/20 px-2.5 py-1 text-xs font-medium text-graphite hover:bg-linen-deep disabled:opacity-50"
                            >
                              {comparingRecommendationId === signal.recommendationId ? "Comparaison en cours — Expérience…" : "Recalculer la comparaison"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => compareOpportunitiesMutation.mutate(signal.recommendationId!)}
                            disabled={audienceActionRunning}
                            className="rounded-md bg-terracotta px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {comparingRecommendationId === signal.recommendationId ? "Comparaison en cours — Expérience…" : "Comparer les opportunités"}
                          </button>
                        )}

                        {comparisonError?.recommendationId === signal.recommendationId && (
                          <div className="mt-1 text-xs text-alert">{comparisonError.message}</div>
                        )}

                        {/* Phase F1 — dispo dès qu'une option a été choisie. */}
                        {signal.comparison?.chosenResultId && renderCreateListAction(signal.recommendationId, signal.exportedListName, signal.exportedAt)}
                      </div>
                    )}

                    {/* Phase E3 — P10 (Comparer les audiences) : bibliothèque de campagnes du mois, bloqué si les automations ne sont pas correctement actives. */}
                    {signal.playbookId === "P10" && signal.recommendationId && (
                      <div className="mt-2">
                        {signal.comparison ? (
                          <div className="flex flex-col gap-1.5">
                            {signal.comparison.month && <div className="text-[11px] uppercase tracking-wide text-graphite-faint">Campagnes de {signal.comparison.month}</div>}
                            {signal.comparison.results.map((result) => (
                              <div
                                key={result.id}
                                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ${result.highlighted ? "bg-terracotta-soft" : "bg-linen"}`}
                              >
                                <div>
                                  <span className="font-medium text-graphite">
                                    {result.highlighted ? "⭐ " : ""}
                                    {result.name}
                                  </span>
                                  <span className="ml-2 text-graphite-faint">
                                    {result.angle ? `${result.angle} — ` : ""}👥 {formatNumber(result.recipients)}
                                    {result.audience && ` (${result.audience})`}
                                  </span>
                                </div>
                                {signal.comparison!.chosenResultId === result.id ? (
                                  <span className="whitespace-nowrap font-medium text-sage">✓ Choisie</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => chooseMutation.mutate({ comparisonId: signal.comparison!.id, resultId: result.id })}
                                    disabled={choosingResultId !== null}
                                    className="whitespace-nowrap rounded-md border border-graphite/20 px-2 py-1 text-xs font-medium text-graphite hover:bg-linen-deep disabled:opacity-50"
                                  >
                                    {choosingResultId === result.id ? "…" : "Choisir"}
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => compareAudiencesMutation.mutate(signal.recommendationId!)}
                              disabled={audienceActionRunning}
                              className="mt-1 self-start rounded-md border border-graphite/20 px-2.5 py-1 text-xs font-medium text-graphite hover:bg-linen-deep disabled:opacity-50"
                            >
                              {comparingAudiencesRecommendationId === signal.recommendationId ? "Comparaison en cours — Expérience…" : "Recalculer la comparaison"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => compareAudiencesMutation.mutate(signal.recommendationId!)}
                            disabled={audienceActionRunning}
                            className="rounded-md bg-terracotta px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {comparingAudiencesRecommendationId === signal.recommendationId ? "Comparaison en cours — Expérience…" : "Comparer les audiences"}
                          </button>
                        )}

                        {automationBlockedMessage?.recommendationId === signal.recommendationId && (
                          <div className="mt-2 rounded-md bg-warn-soft px-2 py-1.5 text-xs text-warn-ink">
                            {automationBlockedMessage.message}
                            {automationBlockedMessage.unexpectedInactive.length > 0 && (
                              <ul className="mt-1 list-disc pl-4">
                                {automationBlockedMessage.unexpectedInactive.map((name) => (
                                  <li key={name}>{name}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        {audienceComparisonError?.recommendationId === signal.recommendationId && (
                          <div className="mt-1 text-xs text-alert">{audienceComparisonError.message}</div>
                        )}

                        {/* Phase F1 — dispo dès qu'une option a été choisie. */}
                        {signal.comparison?.chosenResultId && renderCreateListAction(signal.recommendationId, signal.exportedListName, signal.exportedAt)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const PREVIOUS_YEAR = new Date().getFullYear() - 1;

function KpiCard({ kpi }: { kpi: RealKpiResult }) {
  const hasEvolution = !kpi.dateFilterable && kpi.evolutionPoints !== null && kpi.previousValue !== null;

  return (
    <div className="rounded-lg border border-graphite/10 p-2.5">
      <div className="text-[11px] text-graphite-faint">{kpi.label}</div>
      <div className="font-display text-sm font-semibold tabular-nums">{kpi.value !== null ? formatKpiValue(kpi.kpiDefinitionId, kpi.value) : "—"}</div>
      {hasEvolution ? (
        <div className={`mt-1 text-[10px] font-medium ${kpi.evolutionPoints! >= 0 ? "text-sage" : "text-alert"}`}>
          VS {formatNumber(kpi.previousValue!)}% en {PREVIOUS_YEAR}, {kpi.evolutionPoints! >= 0 ? "+" : ""}
          {formatNumber(kpi.evolutionPoints!)} pts
        </div>
      ) : (
        !kpi.dateFilterable && <div className="mt-1 text-[10px] text-graphite-faint">Comparaison N-1 indisponible</div>
      )}
    </div>
  );
}

function ScanStatusPill({ status }: { status: string }) {
  const style =
    status === "SUCCESS" ? "bg-sage-soft text-sage-ink" : status === "PARTIAL_SUCCESS" ? "bg-warn-soft text-warn-ink" : "bg-alert-soft text-alert-ink";
  const label = status === "SUCCESS" ? "Réussi" : status === "PARTIAL_SUCCESS" ? "Partiel" : status === "FAILED" ? "Échoué" : status;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}
