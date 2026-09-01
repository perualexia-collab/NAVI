import type { CollectHotelKpisResult } from "../experience/collect-hotel-kpis.js";

/**
 * Mappe le résultat brut de collecte vers le catalogue KPI réel
 * (backend/prisma/seed-data/kpi-definitions.ts, issu de "Cartographie KPIs").
 *
 * Règle stricte (arbitrage du 2026-09-01) : uniquement les KPI réellement
 * présents dans le catalogue et effectivement scrapés par ce vertical
 * slice. Deux valeurs scrapées par le moteur n'ont PAS de correspondance
 * dans le catalogue et sont donc volontairement omises ici :
 *   - emailCoverageRate ("Profils avec e-mail renseigné", étape BASE)
 *   - emailsProvided (idem)
 * Elles sont déjà signalées comme candidates possibles au référentiel dans
 * le rapport de session — pas ajoutées au catalogue sans validation.
 * averageSpendPerBooking existe dans le catalogue mais n'est scrapé que par
 * l'Audience Builder (hors périmètre de ce vertical slice) : aucune ligne
 * n'est produite pour ce KPI ici, ce qui est le comportement attendu.
 */
export interface KpiResultRow {
  kpiDefinitionId: string;
  value: number | null;
  available: boolean;
}

export function mapKpiResults(result: CollectHotelKpisResult): KpiResultRow[] {
  const rows: KpiResultRow[] = [];

  const base = result.base.data;
  rows.push(
    { kpiDefinitionId: "totalProfiles", value: base?.totalProfiles ?? null, available: result.base.status === "OK" },
    { kpiDefinitionId: "usableEmails", value: base?.usableEmails ?? null, available: result.base.status === "OK" },
    { kpiDefinitionId: "otaAgencyEmailShare", value: base?.otaAgencyRate ?? null, available: result.base.status === "OK" },
    { kpiDefinitionId: "unsubscribedShare", value: base?.unsubscribedRate ?? null, available: result.base.status === "OK" }
  );

  const capture = result.capture.data;
  rows.push({ kpiDefinitionId: "emailCaptureRate", value: capture?.displayedRate ?? null, available: result.capture.status === "OK" });

  const ota = result.ota.data;
  rows.push(
    { kpiDefinitionId: "otaBookingReservationShare", value: ota?.booking.reservationShare.N ?? null, available: result.ota.status === "OK" },
    { kpiDefinitionId: "otaBookingRevenueShare", value: ota?.booking.revenueShare.N ?? null, available: result.ota.status === "OK" },
    { kpiDefinitionId: "otaExpediaReservationShare", value: ota?.expedia.reservationShare.N ?? null, available: result.ota.status === "OK" },
    { kpiDefinitionId: "otaExpediaRevenueShare", value: ota?.expedia.revenueShare.N ?? null, available: result.ota.status === "OK" },
    { kpiDefinitionId: "nonOtaReservationShare", value: ota?.nonOta.reservationShare.N ?? null, available: result.ota.status === "OK" },
    { kpiDefinitionId: "nonOtaRevenueShare", value: ota?.nonOta.revenueShare.N ?? null, available: result.ota.status === "OK" }
  );

  const returning = result.returning.data;
  rows.push({ kpiDefinitionId: "returningGuestsRate", value: returning?.N ?? null, available: result.returning.status === "OK" });

  const marketing = result.marketing.data;
  rows.push(
    { kpiDefinitionId: "crmRevenue", value: marketing?.total.revenue ?? null, available: result.marketing.status === "OK" },
    { kpiDefinitionId: "crmBookings", value: marketing?.total.bookings ?? null, available: result.marketing.status === "OK" },
    { kpiDefinitionId: "campaignRevenue", value: marketing?.campaigns.revenue ?? null, available: result.marketing.status === "OK" },
    { kpiDefinitionId: "campaignBookings", value: marketing?.campaigns.bookings ?? null, available: result.marketing.status === "OK" },
    { kpiDefinitionId: "automationRevenue", value: marketing?.automations.revenue ?? null, available: result.marketing.status === "OK" },
    { kpiDefinitionId: "automationBookings", value: marketing?.automations.bookings ?? null, available: result.marketing.status === "OK" }
  );

  return rows;
}
