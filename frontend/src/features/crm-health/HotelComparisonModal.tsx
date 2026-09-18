import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal.js";
import { Icon } from "../../components/ui/icons.js";
import { api, ApiError } from "../../lib/api.js";
import { periodLabel } from "../../components/ui/RealPeriodSelector.js";
import type { RealHotel, RealHotelComparisonEntry, RealScanPeriod } from "../../lib/real-hotel-types.js";

const STARS_OPTIONS = [1, 2, 3, 4, 5];

type FilterField = "establishment" | "stars" | "roomCount" | "location";

const FIELD_LABELS: Record<FilterField, string> = {
  establishment: "Établissement",
  stars: "Étoiles",
  roomCount: "Nombre de chambres",
  location: "Emplacement"
};

interface FilterRow {
  id: number;
  field: FilterField;
  /** Plusieurs valeurs possibles — équivaut à un OU implicite entre les établissements choisis dans cette même ligne (demande explicite). */
  establishmentIds: string[];
  stars: string;
  roomMin: string;
  roomMax: string;
  location: string;
}

function createRow(id: number): FilterRow {
  return { id, field: "establishment", establishmentIds: [], stars: "", roomMin: "", roomMax: "", location: "" };
}

/** Une ligne "vide" (aucune valeur choisie) ne compte pas comme un filtre actif — voir hasActiveFilter. */
function rowHasValue(row: FilterRow): boolean {
  switch (row.field) {
    case "establishment":
      return row.establishmentIds.length > 0;
    case "stars":
      return row.stars !== "";
    case "location":
      return row.location !== "";
    case "roomCount":
      return row.roomMin !== "" || row.roomMax !== "";
  }
}

function rowMatches(hotel: RealHotel, row: FilterRow): boolean {
  switch (row.field) {
    case "establishment":
      return row.establishmentIds.length === 0 || row.establishmentIds.includes(hotel.id);
    case "stars":
      return row.stars === "" || hotel.stars === Number(row.stars);
    case "location":
      return row.location === "" || hotel.location === row.location;
    case "roomCount": {
      if (row.roomMin === "" && row.roomMax === "") return true;
      if (hotel.roomCount === null) return false;
      if (row.roomMin && hotel.roomCount < Number(row.roomMin)) return false;
      if (row.roomMax && hotel.roomCount > Number(row.roomMax)) return false;
      return true;
    }
  }
}

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
 * Phase I1 (retour réel 2026-09-18, révisé le même jour) — bouton
 * "Comparaison" sur la fiche CRM Health. Deux étapes dans la même
 * modale : filtres → construction du panel, puis tableau comparatif
 * (jamais les deux en même temps).
 *
 * Filtres construits comme une liste de lignes "étiquette → est → valeur"
 * reliées par ET/OU (inspiré de la capture de référence fournie), évalués
 * de façon strictement séquentielle gauche-à-droite (pas de parenthésage
 * ni de groupes imbriqués — volontairement simple, la demande ne portait
 * que sur l'apparence/logique étiquette→valeur + ET/OU à plat, pas sur
 * des groupes de filtres imbriqués).
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

  const nextRowId = useRef(1);
  const [rows, setRows] = useState<FilterRow[]>([createRow(0)]);
  const [connectors, setConnectors] = useState<("ET" | "OU")[]>([]);

  function updateRow(id: number, patch: Partial<FilterRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, createRow(nextRowId.current++)]);
    setConnectors((prev) => [...prev, "ET"]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setConnectors((prev) => prev.filter((_, i) => i !== Math.max(0, index - 1)));
  }

  function resetFilters() {
    setRows([createRow(nextRowId.current++)]);
    setConnectors([]);
  }

  // Retour réel 2026-09-18 — tant qu'aucun critère n'a de valeur choisie,
  // on ne considère pas qu'un filtre est "actif" : pas de liste affichée
  // (voir plus bas), et matchingHotels reste vide plutôt que de lister
  // silencieusement tout le catalogue.
  const hasActiveFilter = rows.some(rowHasValue);

  const matchingHotels = useMemo(() => {
    if (!hasActiveFilter) return [];
    return allHotels.filter((hotel) => {
      let result = rowMatches(hotel, rows[0]!);
      for (let i = 1; i < rows.length; i++) {
        const current = rowMatches(hotel, rows[i]!);
        result = connectors[i - 1] === "OU" ? result || current : result && current;
      }
      return result;
    });
  }, [allHotels, rows, connectors, hasActiveFilter]);

  const [results, setResults] = useState<RealHotelComparisonEntry[] | null>(null);
  const compareMutation = useMutation({
    mutationFn: (hotelIds: string[]) => api.getHotelComparison(hotelIds),
    onSuccess: (data) => setResults(data)
  });

  return (
    <Modal title={results ? `Comparaison — ${currentHotel.name}` : "Comparer avec d'autres hôtels"} onClose={onClose} wide veryWide={Boolean(results)}>
      {!results ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            {rows.map((row, index) => (
              <div key={row.id}>
                {index > 0 && (
                  <div className="my-1.5">
                    <select
                      value={connectors[index - 1]}
                      onChange={(e) =>
                        setConnectors((prev) => prev.map((c, i) => (i === index - 1 ? (e.target.value as "ET" | "OU") : c)))
                      }
                      className="rounded-lg border border-graphite/20 bg-parchment-soft px-2 py-1 text-xs font-medium text-graphite-soft outline-none focus:border-terracotta"
                    >
                      <option value="ET">ET</option>
                      <option value="OU">OU</option>
                    </select>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-linen-deep/60 p-3">
                  <select
                    value={row.field}
                    onChange={(e) => updateRow(row.id, { field: e.target.value as FilterField })}
                    className="rounded-lg border border-graphite/20 bg-parchment-soft px-2 py-1.5 text-sm outline-none focus:border-terracotta"
                  >
                    {(Object.keys(FIELD_LABELS) as FilterField[]).map((field) => (
                      <option key={field} value={field}>
                        {FIELD_LABELS[field]}
                      </option>
                    ))}
                  </select>

                  {row.field !== "roomCount" && <span className="text-xs text-graphite-faint">est</span>}

                  {row.field === "establishment" && (
                    <select
                      multiple
                      value={row.establishmentIds}
                      onChange={(e) => updateRow(row.id, { establishmentIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
                      title="Ctrl/Cmd + clic pour en choisir plusieurs"
                      className="h-24 min-w-[12rem] rounded-lg border border-graphite/20 bg-parchment-soft px-2 py-1.5 text-sm outline-none focus:border-terracotta"
                    >
                      {allHotels.map((hotel) => (
                        <option key={hotel.id} value={hotel.id}>
                          {hotel.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {row.field === "stars" && (
                    <select
                      value={row.stars}
                      onChange={(e) => updateRow(row.id, { stars: e.target.value })}
                      className="rounded-lg border border-graphite/20 bg-parchment-soft px-2 py-1.5 text-sm outline-none focus:border-terracotta"
                    >
                      <option value="">— Choisir —</option>
                      {STARS_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n} étoile{n > 1 ? "s" : ""}
                        </option>
                      ))}
                    </select>
                  )}

                  {row.field === "location" && (
                    <select
                      value={row.location}
                      onChange={(e) => updateRow(row.id, { location: e.target.value })}
                      className="min-w-[8rem] rounded-lg border border-graphite/20 bg-parchment-soft px-2 py-1.5 text-sm outline-none focus:border-terracotta"
                    >
                      <option value="">— Choisir —</option>
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  )}

                  {row.field === "roomCount" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={row.roomMin}
                        onChange={(e) => updateRow(row.id, { roomMin: e.target.value })}
                        placeholder={roomCountRange ? `De (min. ${roomCountRange.min})` : "De"}
                        className="w-28 rounded-lg border border-graphite/20 bg-parchment-soft px-2 py-1.5 text-sm outline-none focus:border-terracotta"
                      />
                      <span className="text-graphite-faint">à</span>
                      <input
                        type="number"
                        min={0}
                        value={row.roomMax}
                        onChange={(e) => updateRow(row.id, { roomMax: e.target.value })}
                        placeholder={roomCountRange ? `À (max. ${roomCountRange.max})` : "À"}
                        className="w-28 rounded-lg border border-graphite/20 bg-parchment-soft px-2 py-1.5 text-sm outline-none focus:border-terracotta"
                      />
                    </div>
                  )}

                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      title="Retirer ce filtre"
                      className="ml-auto text-graphite-faint hover:text-alert"
                    >
                      <Icon.Trash width={14} height={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button type="button" onClick={addRow} className="mt-1.5 flex w-fit items-center gap-1 text-xs font-medium text-terracotta hover:underline">
              <Icon.Plus width={13} height={13} /> Ajouter un filtre
            </button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={resetFilters} className="text-xs font-medium text-terracotta hover:underline">
              Réinitialiser les filtres
            </button>
            {hasActiveFilter && (
              <span className="text-graphite-faint">
                {matchingHotels.length} hôtel{matchingHotels.length !== 1 ? "s" : ""} correspondant{matchingHotels.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {hasActiveFilter && matchingHotels.length > 0 && (
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
              disabled={!hasActiveFilter || matchingHotels.length === 0 || compareMutation.isPending}
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
