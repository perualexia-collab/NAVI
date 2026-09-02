import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../components/ui/Card.js";
import { ScoreRing } from "../components/ui/ScoreRing.js";
import { Modal } from "../components/ui/Modal.js";
import { TrendLabel } from "../components/ui/StatusPill.js";
import { DateRangeControl } from "../components/ui/DateRangeControl.js";
import { Icon } from "../components/ui/icons.js";
import { HotelsTable } from "../components/HotelsTable.js";
import { hotelsByPortfolio, portfolios as mockPortfolios } from "../mock/data.js";
import type { MockHotel, MockPortfolio } from "../mock/types.js";
import { api, ApiError } from "../lib/api.js";
import type { RealHotel, RealPortfolio, RealPortfolioHotel, ScanPeriodValue } from "../lib/real-hotel-types.js";

const STATUS_FILTERS = ["Tous les statuts", "Excellent", "Sain", "À surveiller", "Critique", "Aucun scan"] as const;

type FormModalState = { mode: "create" } | { mode: "edit"; portfolio: RealPortfolio } | null;

// Le niveau réel (Critique/Fragile/Correct/Bon/Excellent, moteur de
// scoring backend) est reregroupé sur le vocabulaire StatusPill existant
// (Excellent/Sain/À surveiller/Critique/Aucun scan) — retours réels
// Phase C (2026-09-02) : la liste des hôtels d'un portefeuille réel doit
// avoir le même format que le tableau CRM Health générique.
function statusFromHealthLevel(level: RealPortfolioHotel["healthLevel"] | undefined): MockHotel["status"] {
  if (!level) return "Aucun scan";
  if (level === "Excellent") return "Excellent";
  if (level === "Bon" || level === "Correct") return "Sain";
  if (level === "Fragile") return "À surveiller";
  return "Critique";
}

function toMockHotel(hotel: RealPortfolioHotel, portfolioId: string, portfolioName: string): MockHotel {
  return {
    id: hotel.id,
    name: hotel.name,
    portfolioId,
    portfolioName,
    lastScanAt: hotel.lastScanAt ?? null,
    healthScore: hotel.healthScore ?? null,
    healthLevel: hotel.healthLevel ?? null,
    alerts: hotel.alerts ?? null,
    vigilances: hotel.vigilances ?? null,
    opportunities: hotel.opportunities ?? null,
    status: statusFromHealthLevel(hotel.healthLevel)
  };
}

/**
 * Portefeuilles NAVI — retours Phase C.5, §1 : les portefeuilles créés via
 * "Ajouter un portefeuille" sont désormais persistés en PostgreSQL (voir
 * backend/src/api/routes/portfolios.ts), plus une logique frontend
 * temporaire. Les 4 portefeuilles mockés (Paris Collection, Côte d'Azur,
 * Resorts, City Breaks) restent des données de démonstration inchangées —
 * ni modifiables ni supprimables (retours réels Phase C, 2026-09-02 :
 * édition/suppression n'existent que pour les portefeuilles réels).
 */
export function Portfolios() {
  const queryClient = useQueryClient();
  const portfoliosQuery = useQuery({ queryKey: ["portfolios"], queryFn: api.listPortfolios });
  const hotelsQuery = useQuery({ queryKey: ["hotels"], queryFn: api.listRealHotels });

  const realPortfolios = portfoliosQuery.data ?? [];
  const cards: MockPortfolio[] = useMemo(
    () => [
      ...mockPortfolios,
      ...realPortfolios.map((rp) => ({
        id: rp.id,
        name: rp.name,
        hotelCount: rp.hotels.length,
        healthScore: rp.health.healthScore,
        healthDelta: 0,
        scannedCount: rp.health.scannedCount,
        toScanCount: rp.health.toScanCount,
        criticalCount: rp.health.criticalCount
      }))
    ],
    [realPortfolios]
  );

  const [selectedId, setSelectedId] = useState(mockPortfolios[0]!.id);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("Tous les statuts");
  const [formModal, setFormModal] = useState<FormModalState>(null);
  const [scanPeriod, setScanPeriod] = useState<ScanPeriodValue>("last12Months");

  const selected = cards.find((p) => p.id === selectedId) ?? cards[0]!;
  const selectedRealPortfolio = realPortfolios.find((rp) => rp.id === selected.id);

  const mockHotels = useMemo(() => {
    return hotelsByPortfolio(selected.id).filter((hotel) => {
      const matchesSearch = hotel.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "Tous les statuts" || hotel.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [selected.id, search, statusFilter]);

  const realHotelsInPortfolio = useMemo(() => {
    if (!selectedRealPortfolio) return [];
    return selectedRealPortfolio.hotels.filter((hotel) => hotel.name.toLowerCase().includes(search.toLowerCase()));
  }, [selectedRealPortfolio, search]);

  const createMutation = useMutation({
    mutationFn: ({ name, hotelIds }: { name: string; hotelIds: string[] }) => api.createPortfolio(name, hotelIds),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      setSelectedId(created.id);
      setFormModal(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, hotelIds }: { id: string; name: string; hotelIds: string[] }) =>
      api.updatePortfolio(id, { name, hotelIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      setFormModal(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePortfolio(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      if (selectedId === deletedId) setSelectedId(mockPortfolios[0]!.id);
    }
  });

  function handleDelete(portfolio: RealPortfolio) {
    const confirmed = window.confirm(
      `Supprimer le portefeuille "${portfolio.name}" ? Les hôtels et leurs scans ne sont pas supprimés, seul ce regroupement l'est.`
    );
    if (confirmed) deleteMutation.mutate(portfolio.id);
  }

  const scanPortfolioMutation = useMutation({
    mutationFn: (portfolioId: string) => api.launchPortfolioScan(portfolioId, scanPeriod),
    onSuccess: () => {
      // Phase D1 : pas de suivi temps réel (Phase D2) — les scans tournent
      // en arrière-plan, un rechargement des données du portefeuille fait
      // apparaître les statuts au fur et à mesure qu'ils se terminent.
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
    }
  });

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl">Mes portefeuilles</h1>
          <p className="mt-1 text-sm text-graphite-soft">Organisez vos ensembles d'hôtels et suivez leur santé CRM globale.</p>
        </div>
        <button
          onClick={() => setFormModal({ mode: "create" })}
          className="flex items-center gap-1.5 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Icon.Plus width={16} height={16} /> Nouveau portefeuille
        </button>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4">
        {cards.map((portfolio) => {
          const isSelected = portfolio.id === selected.id;
          return (
            <button key={portfolio.id} onClick={() => setSelectedId(portfolio.id)} className="text-left">
              <Card className={isSelected ? "border-terracotta" : "hover:border-graphite/20"}>
                <div className="text-sm font-medium">{portfolio.name}</div>
                <div className="text-xs text-graphite-faint">{portfolio.hotelCount} hôtels</div>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-graphite-faint">Santé CRM</div>
                    {portfolio.healthScore === null ? (
                      <div className="text-xs text-graphite-faint">Première analyse</div>
                    ) : (
                      <>
                        <TrendLabel delta={portfolio.healthDelta} />
                        <div className="text-[10px] text-graphite-faint">vs période précédente</div>
                      </>
                    )}
                  </div>
                  <ScoreRing score={portfolio.healthScore} size={68} strokeWidth={6} />
                </div>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-graphite-soft">
                  <LegendDot color="bg-sage" label={`${portfolio.scannedCount} scannés`} />
                  <LegendDot color="bg-warn" label={`${portfolio.toScanCount} à scanner`} />
                  <LegendDot color="bg-alert" label={`${portfolio.criticalCount} critique`} />
                </div>
              </Card>
            </button>
          );
        })}
      </div>

      <Card className="mt-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            Détail du portefeuille : {selected.name}
            <span className="rounded-full bg-linen-deep px-2 py-0.5 text-xs font-normal text-graphite-soft">{selected.hotelCount} hôtels</span>
            {selectedRealPortfolio && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFormModal({ mode: "edit", portfolio: selectedRealPortfolio })}
                  title="Modifier le portefeuille"
                  className="rounded-lg p-1.5 text-graphite-soft hover:bg-linen-deep hover:text-graphite"
                >
                  <Icon.Edit width={14} height={14} />
                </button>
                <button
                  onClick={() => handleDelete(selectedRealPortfolio)}
                  title="Supprimer le portefeuille"
                  className="rounded-lg p-1.5 text-graphite-soft hover:bg-alert-soft hover:text-alert"
                >
                  <Icon.Trash width={14} height={14} />
                </button>
              </div>
            )}
          </div>
        </div>

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
          {selectedRealPortfolio ? (
            <>
              <select
                value={scanPeriod}
                onChange={(e) => setScanPeriod(e.target.value as ScanPeriodValue)}
                className="rounded-lg border border-graphite/15 bg-linen px-3 py-2 text-sm text-graphite-soft"
              >
                <option value="last3Months">3 derniers mois</option>
                <option value="last6Months">6 derniers mois</option>
                <option value="last12Months">12 derniers mois</option>
              </select>
              <button
                onClick={() => scanPortfolioMutation.mutate(selectedRealPortfolio.id)}
                disabled={scanPortfolioMutation.isPending || selectedRealPortfolio.hotels.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-sage px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                <Icon.Play width={14} height={14} /> {scanPortfolioMutation.isPending ? "Lancement…" : "Lancer un scan portefeuille"}
              </button>
            </>
          ) : (
            <>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as (typeof STATUS_FILTERS)[number])}
                className="rounded-lg border border-graphite/15 bg-linen px-3 py-2 text-sm text-graphite-soft"
              >
                {STATUS_FILTERS.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
              <DateRangeControl />
              <button className="flex items-center gap-1.5 rounded-lg bg-sage px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                <Icon.Play width={14} height={14} /> Lancer un scan portefeuille
              </button>
            </>
          )}
        </div>

        {selectedRealPortfolio && scanPortfolioMutation.isSuccess && (
          <p className="mb-4 rounded-lg bg-horizon-soft px-3 py-2 text-sm text-horizon-ink">
            Scan lancé pour {scanPortfolioMutation.data.scanHotelIds.length} hôtel{scanPortfolioMutation.data.scanHotelIds.length > 1 ? "s" : ""} — traitement en
            arrière-plan, actualise la page pour voir les statuts se mettre à jour.
          </p>
        )}
        {selectedRealPortfolio && scanPortfolioMutation.isError && (
          <p className="mb-4 rounded-lg bg-alert-soft px-3 py-2 text-sm text-alert-ink">
            {scanPortfolioMutation.error instanceof ApiError ? scanPortfolioMutation.error.message : "Le scan du portefeuille n'a pas pu être lancé."}
          </p>
        )}

        <HotelsTable
          hotels={
            selectedRealPortfolio
              ? realHotelsInPortfolio.map((h) => toMockHotel(h, selectedRealPortfolio.id, selectedRealPortfolio.name))
              : mockHotels
          }
        />
      </Card>

      {formModal && (
        <PortfolioFormModal
          mode={formModal.mode}
          initialName={formModal.mode === "edit" ? formModal.portfolio.name : ""}
          initialHotelIds={formModal.mode === "edit" ? formModal.portfolio.hotels.map((h) => h.id) : []}
          hotels={hotelsQuery.data ?? []}
          hotelsLoading={hotelsQuery.isLoading}
          submitting={createMutation.isPending || updateMutation.isPending}
          error={
            (createMutation.error instanceof ApiError ? createMutation.error.message : null) ??
            (updateMutation.error instanceof ApiError ? updateMutation.error.message : null)
          }
          onClose={() => setFormModal(null)}
          onSubmit={(name, hotelIds) =>
            formModal.mode === "create"
              ? createMutation.mutate({ name, hotelIds })
              : updateMutation.mutate({ id: formModal.portfolio.id, name, hotelIds })
          }
        />
      )}
    </div>
  );
}

function PortfolioFormModal({
  mode,
  initialName,
  initialHotelIds,
  hotels,
  hotelsLoading,
  submitting,
  error,
  onClose,
  onSubmit
}: {
  mode: "create" | "edit";
  initialName: string;
  initialHotelIds: string[];
  hotels: RealHotel[];
  hotelsLoading: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (name: string, hotelIds: string[]) => void;
}) {
  const [name, setName] = useState(initialName);
  const [selectedHotelIds, setSelectedHotelIds] = useState<string[]>(initialHotelIds);

  function toggleHotel(id: string) {
    setSelectedHotelIds((prev) => (prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || selectedHotelIds.length === 0) return;
    onSubmit(name.trim(), selectedHotelIds);
  }

  return (
    <Modal title={mode === "create" ? "Nouveau portefeuille" : "Modifier le portefeuille"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-graphite">
          Nom du portefeuille
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Portefeuille Sud-Ouest"
            className="rounded-lg border border-graphite/20 bg-parchment-soft px-3 py-2 text-sm outline-none focus:border-terracotta"
          />
        </label>

        <div className="flex flex-col gap-1 text-sm text-graphite">
          Hôtels ({selectedHotelIds.length} sélectionné{selectedHotelIds.length > 1 ? "s" : ""})
          {hotelsLoading ? (
            <p className="py-2 text-sm text-graphite-faint">Chargement…</p>
          ) : hotels.length === 0 ? (
            <p className="py-2 text-sm text-graphite-faint">
              Aucun hôtel enregistré dans NAVI pour l'instant — ajoute-en un depuis Paramètres → Hôtels.
            </p>
          ) : (
            <div className="max-h-52 overflow-y-auto rounded-lg border border-graphite/15">
              {hotels.map((hotel) => (
                <label key={hotel.id} className="flex items-center gap-2 border-b border-graphite/5 px-3 py-2 text-sm last:border-0 hover:bg-linen-deep">
                  <input
                    type="checkbox"
                    checked={selectedHotelIds.includes(hotel.id)}
                    onChange={() => toggleHotel(hotel.id)}
                    className="rounded border-graphite/30"
                  />
                  <span className="flex-1">{hotel.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-alert">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-graphite-soft hover:bg-linen-deep">
            Annuler
          </button>
          <button
            type="submit"
            disabled={!name.trim() || selectedHotelIds.length === 0 || submitting}
            className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? (mode === "create" ? "Création…" : "Enregistrement…") : mode === "create" ? "Créer le portefeuille" : "Enregistrer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} /> {label}
    </span>
  );
}
