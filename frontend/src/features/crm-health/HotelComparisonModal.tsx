import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal.js";
import { Icon } from "../../components/ui/icons.js";
import { api, ApiError } from "../../lib/api.js";
import { periodLabel } from "../../components/ui/RealPeriodSelector.js";
import type { RealHotel, RealHotelComparisonEntry, RealScanPeriod } from "../../lib/real-hotel-types.js";

const STARS_OPTIONS = [1, 2, 3, 4, 5];

function periodKey(period: RealScanPeriod): string {
  return period.mode === "preset" ? `preset:${period.value}` : `custom:${period.startDate}:${period.endDate}`;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}

function formatScoreCell(value: number | null): string {
  return value === null ? "—" : String(Math.round(value * 10) / 10);
}

/**
 * Phase I1 (retour réel 2026-09-18) — bouton "Comparaison" sur la fiche
 * CRM Health. Deux étapes dans la même modale : filtres → construction du
 * panel, puis tableau comparatif (jamais les deux en même temps).
 *
 * Filtres combinés en ET uniquement (pas de ET/OU imbriqué, volontaire —
 * demande explicite de rester simple pour cette première version) ;
 * "Établissement" permet de choisir directement des hôtels précis en plus
 * des autres critères.
 */
export function HotelComparisonModal({ currentHotel, onClose }: { currentHotel: RealHotel; onClose: () => void }) {
  const hotelsQuery = useQuery({ queryKey: ["hotels"], queryFn: api.listRealHotels });
  const allHotels = useMemo(() => (hotelsQuery.data ?? []).filter((h) => h.id !== currentHotel.id), [hotelsQuery.data, currentHotel.id]);

  // Valeurs de filtre issues des hôtels réellement enregistrés — jamais
  // codées en dur (seul "Étoiles" l'est, demande explicite).
  const locations = useMemo(
    () => [...new Set(allHotels.map((h) => h.location).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b)),
    [allHotels]
  );
  const roomCounts = allHotels.map((h) => h.roomCount).filter((v): v is number => v !== null);
  const roomCountRange = roomCounts.length > 0 ? { min: Math.min(...roomCounts), max: Math.max(...roomCounts) } : null;

  const [selectedHotelIds, setSelectedHotelIds] = useState<string[]>([]);
  const [starsFilter, setStarsFilter] = useState<number | null>(null);
  const [roomMin, setRoomMin] = useState("");
  const [roomMax, setRoomMax] = useState("");
  const [locationFilter, setLocationFilter] = useState<string | null>(null);

  function resetFilters() {
    setSelectedHotelIds([]);
    setStarsFilter(null);
    setRoomMin("");
    setRoomMax("");
    setLocationFilter(null);
  }

  const matchingHotels = useMemo(
    () =>
      allHotels.filter((hotel) => {
        if (selectedHotelIds.length > 0 && !selectedHotelIds.includes(hotel.id)) return false;
        if (starsFilter !== null && hotel.stars !== starsFilter) return false;
        if (roomMin && (hotel.roomCount === null || hotel.roomCount < Number(roomMin))) return false;
        if (roomMax && (hotel.roomCount === null || hotel.roomCount > Number(roomMax))) return false;
        if (locationFilter && hotel.location !== locationFilter) return false;
        return true;
      }),
    [allHotels, selectedHotelIds, starsFilter, roomMin, roomMax, locationFilter]
  );

  const [results, setResults] = useState<RealHotelComparisonEntry[] | null>(null);
  const compareMutation = useMutation({
    mutationFn: (hotelIds: string[]) => api.getHotelComparison(hotelIds),
    onSuccess: (data) => setResults(data)
  });

  return (
    <Modal title={results ? `Comparaison — ${currentHotel.name}` : "Comparer avec d'autres hôtels"} onClose={onClose} wide>
      {!results ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-graphite">
              Établissement
              <select
                multiple
                value={selectedHotelIds}
                onChange={(e) => setSelectedHotelIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                className="h-24 rounded-lg border border-graphite/20 bg-parchment-soft px-2 py-1.5 text-sm outline-none focus:border-terracotta"
              >
                {allHotels.map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>
                    {hotel.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm text-graphite">
                Étoiles
                <select
                  value={starsFilter ?? ""}
                  onChange={(e) => setStarsFilter(e.target.value === "" ? null : Number(e.target.value))}
                  className="rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2 text-sm outline-none focus:border-terracotta"
                >
                  <option value="">Toutes</option>
                  {STARS_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} étoile{n > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-graphite">
                Emplacement
                <select
                  value={locationFilter ?? ""}
                  onChange={(e) => setLocationFilter(e.target.value === "" ? null : e.target.value)}
                  className="rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2 text-sm outline-none focus:border-terracotta"
                >
                  <option value="">Tous</option>
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="col-span-2 flex flex-col gap-1 text-sm text-graphite">
              Nombre de chambres
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={roomMin}
                  onChange={(e) => setRoomMin(e.target.value)}
                  placeholder={roomCountRange ? `De (min. ${roomCountRange.min})` : "De"}
                  className="w-full rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2 text-sm outline-none focus:border-terracotta"
                />
                <span className="text-graphite-faint">à</span>
                <input
                  type="number"
                  min={0}
                  value={roomMax}
                  onChange={(e) => setRoomMax(e.target.value)}
                  placeholder={roomCountRange ? `À (max. ${roomCountRange.max})` : "À"}
                  className="w-full rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2 text-sm outline-none focus:border-terracotta"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={resetFilters} className="text-xs font-medium text-terracotta hover:underline">
              Réinitialiser les filtres
            </button>
            <span className="text-graphite-faint">
              {matchingHotels.length} hôtel{matchingHotels.length !== 1 ? "s" : ""} correspondant{matchingHotels.length !== 1 ? "s" : ""}
            </span>
          </div>

          {matchingHotels.length > 0 && (
            <ul className="max-h-28 overflow-y-auto rounded-lg border border-graphite/10 p-2 text-sm text-graphite-soft">
              {matchingHotels.map((h) => (
                <li key={h.id}>{h.name}</li>
              ))}
            </ul>
          )}

          {compareMutation.isError && (
            <p className="text-sm text-alert">
              {compareMutation.error instanceof ApiError ? compareMutation.error.message : "La comparaison a échoué."}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-graphite-soft hover:bg-linen-deep">
              Annuler
            </button>
            <button
              type="button"
              onClick={() => compareMutation.mutate([currentHotel.id, ...matchingHotels.map((h) => h.id)])}
              disabled={matchingHotels.length === 0 || compareMutation.isPending}
              className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {compareMutation.isPending ? "Chargement…" : "Voir la comparaison"}
            </button>
          </div>
        </div>
      ) : (
        <ComparisonResults entries={results} currentHotelId={currentHotel.id} onBack={() => setResults(null)} />
      )}
    </Modal>
  );
}

/**
 * Score CRM global (baseScore/captureScore/activationScore inclus) n'est
 * comparable qu'entre hôtels scannés sur la même période (ces 3 piliers
 * dérivent de KPI filtrables par période — backend/src/services/scoring/
 * crm-health.ts). Fidélisation (loyaltyScore) et Dépendance OTA (otaScore)
 * dérivent de KPI toujours "année N vs N-1", donc comparables quelle que
 * soit la période — jamais grisés.
 */
function ComparisonResults({
  entries,
  currentHotelId,
  onBack
}: {
  entries: RealHotelComparisonEntry[];
  currentHotelId: string;
  onBack: () => void;
}) {
  const current = entries.find((e) => e.hotelId === currentHotelId) ?? null;
  const currentPeriodKey = current?.hasScan && current.period ? periodKey(current.period) : null;

  function samePeriod(entry: RealHotelComparisonEntry): boolean {
    return Boolean(currentPeriodKey && entry.hasScan && entry.period && periodKey(entry.period) === currentPeriodKey);
  }

  const others = entries.filter((e) => e.hotelId !== currentHotelId);
  const samePeriodOthers = others.filter(samePeriod);
  const differentPeriodOthers = others.filter((e) => e.hasScan && !samePeriod(e));

  function avgOf(list: RealHotelComparisonEntry[], key: "healthScore" | "baseScore" | "captureScore" | "activationScore" | "otaScore" | "loyaltyScore") {
    return average(list.map((e) => e[key]).filter((v): v is number => v !== null));
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="self-start text-xs font-medium text-terracotta hover:underline">
        ← Modifier les filtres
      </button>

      {differentPeriodOthers.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn-ink">
          <Icon.AlertTriangle width={14} height={14} className="mt-0.5 shrink-0" />
          <span>
            Période de scan différente de l'hôtel actuel pour {differentPeriodOthers.map((e) => e.hotelName).join(", ")} — leur score CRM global et le
            détail base/captation/activation ne sont pas comparés (colonnes grisées). Fidélisation et dépendance OTA restent comparables (toujours calculés
            en année N vs N-1, indépendamment de la période).
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-graphite/10 text-left text-[11px] uppercase tracking-wide text-graphite-faint">
              <th className="pb-2 pr-3 font-medium">Hôtel</th>
              <th className="pb-2 pr-3 font-medium">Période du scan</th>
              <th className="pb-2 pr-3 font-medium">Score CRM /100</th>
              <th className="pb-2 pr-3 font-medium">Fidélisation /20</th>
              <th className="pb-2 pr-3 font-medium">Dépendance OTA /20</th>
              <th className="pb-2 pr-3 font-medium">Base exploitable /20</th>
              <th className="pb-2 pr-3 font-medium">Captation /15</th>
              <th className="pb-2 font-medium">Activation CRM /25</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isCurrent = entry.hotelId === currentHotelId;
              const periodOk = isCurrent || samePeriod(entry);
              return (
                <tr key={entry.hotelId} className={`border-b border-graphite/5 last:border-0 ${isCurrent ? "bg-terracotta-soft/40 font-medium" : ""}`}>
                  <td className="py-2 pr-3">
                    {entry.hotelName}
                    {isCurrent && <span className="ml-1 text-[10px] font-normal text-terracotta">(actuel)</span>}
                  </td>
                  <td className="pr-3 text-graphite-soft">{entry.hasScan && entry.period ? periodLabel(entry.period) : "Aucun scan"}</td>
                  <td className="pr-3 tabular-nums">{periodOk ? formatScoreCell(entry.healthScore) : "—"}</td>
                  <td className="pr-3 tabular-nums">{formatScoreCell(entry.loyaltyScore)}</td>
                  <td className="pr-3 tabular-nums">{formatScoreCell(entry.otaScore)}</td>
                  <td className={`pr-3 tabular-nums ${periodOk ? "" : "text-graphite-faint"}`}>{periodOk ? formatScoreCell(entry.baseScore) : "—"}</td>
                  <td className={`pr-3 tabular-nums ${periodOk ? "" : "text-graphite-faint"}`}>{periodOk ? formatScoreCell(entry.captureScore) : "—"}</td>
                  <td className={`tabular-nums ${periodOk ? "" : "text-graphite-faint"}`}>{periodOk ? formatScoreCell(entry.activationScore) : "—"}</td>
                </tr>
              );
            })}
            <tr className="text-graphite-soft">
              <td className="pt-2 pr-3 font-medium">Moyenne du panel</td>
              <td className="pt-2 pr-3" />
              <td className="pt-2 pr-3 tabular-nums">{formatScoreCell(avgOf(samePeriodOthers, "healthScore"))}</td>
              <td className="pt-2 pr-3 tabular-nums">{formatScoreCell(avgOf(others, "loyaltyScore"))}</td>
              <td className="pt-2 pr-3 tabular-nums">{formatScoreCell(avgOf(others, "otaScore"))}</td>
              <td className="pt-2 pr-3 tabular-nums">{formatScoreCell(avgOf(samePeriodOthers, "baseScore"))}</td>
              <td className="pt-2 pr-3 tabular-nums">{formatScoreCell(avgOf(samePeriodOthers, "captureScore"))}</td>
              <td className="pt-2 tabular-nums">{formatScoreCell(avgOf(samePeriodOthers, "activationScore"))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-graphite-faint">
        "Moyenne du panel" exclut {current?.hotelName ?? "l'hôtel actuel"} — c'est la moyenne des hôtels comparés, à mettre en regard de sa propre ligne
        ci-dessus. Scores calculés à partir du dernier scan connu de chaque hôtel.
      </p>
    </div>
  );
}
