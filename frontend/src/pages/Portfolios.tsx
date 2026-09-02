import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../components/ui/Card.js";
import { ScoreRing } from "../components/ui/ScoreRing.js";
import { Modal } from "../components/ui/Modal.js";
import { TrendLabel } from "../components/ui/StatusPill.js";
import { DateRangeControl } from "../components/ui/DateRangeControl.js";
import { Icon } from "../components/ui/icons.js";
import { HotelsTable } from "../components/HotelsTable.js";
import { hotelsByPortfolio, portfolios as mockPortfolios } from "../mock/data.js";
import type { MockPortfolio } from "../mock/types.js";
import { api, ApiError } from "../lib/api.js";
import type { RealHotel } from "../lib/real-hotel-types.js";

const STATUS_FILTERS = ["Tous les statuts", "Excellent", "Sain", "À surveiller", "Critique", "Aucun scan"] as const;

const EXPERIENCE_STATUS_LABEL = {
  ACTIVE: "Actif",
  TO_VERIFY: "À vérifier",
  NOT_FOUND: "Non trouvé",
  ERROR: "Erreur"
} as const;

const EXPERIENCE_STATUS_STYLE = {
  ACTIVE: "bg-sage-soft text-sage-ink",
  TO_VERIFY: "bg-warn-soft text-warn-ink",
  NOT_FOUND: "bg-linen-deep text-graphite-faint",
  ERROR: "bg-alert-soft text-alert-ink"
} as const;

/**
 * Portefeuilles NAVI — retours Phase C.5, §1 : les portefeuilles créés via
 * "Ajouter un portefeuille" sont désormais persistés en PostgreSQL (voir
 * backend/src/api/routes/portfolios.ts), plus une logique frontend
 * temporaire. Les 4 portefeuilles mockés (Paris Collection, Côte d'Azur,
 * Resorts, City Breaks) restent des données de démonstration inchangées.
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
  const [modalOpen, setModalOpen] = useState(false);

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
      setModalOpen(false);
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
          onClick={() => setModalOpen(true)}
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
          {!selectedRealPortfolio && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as (typeof STATUS_FILTERS)[number])}
              className="rounded-lg border border-graphite/15 bg-linen px-3 py-2 text-sm text-graphite-soft"
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          )}
          <DateRangeControl />
          {!selectedRealPortfolio && (
            <button className="flex items-center gap-1.5 rounded-lg bg-sage px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              <Icon.Play width={14} height={14} /> Lancer un scan portefeuille
            </button>
          )}
        </div>

        {selectedRealPortfolio ? (
          <RealPortfolioHotels hotels={realHotelsInPortfolio} />
        ) : (
          <HotelsTable hotels={mockHotels} />
        )}
      </Card>

      {modalOpen && (
        <CreatePortfolioModal
          hotels={hotelsQuery.data ?? []}
          hotelsLoading={hotelsQuery.isLoading}
          submitting={createMutation.isPending}
          error={createMutation.error instanceof ApiError ? createMutation.error.message : null}
          onClose={() => setModalOpen(false)}
          onCreate={(name, hotelIds) => createMutation.mutate({ name, hotelIds })}
        />
      )}
    </div>
  );
}

function RealPortfolioHotels({ hotels }: { hotels: RealHotel[] }) {
  if (hotels.length === 0) {
    return <p className="py-6 text-center text-sm text-graphite-faint">Aucun hôtel dans ce portefeuille pour l'instant.</p>;
  }
  return (
    <div className="flex flex-col divide-y divide-graphite/10">
      {hotels.map((hotel) => (
        <Link key={hotel.id} to={`/crm-health/${hotel.id}`} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 hover:opacity-80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linen-deep text-graphite-soft">
              <Icon.Building width={15} height={15} />
            </div>
            <div className="text-sm font-medium">{hotel.name}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${EXPERIENCE_STATUS_STYLE[hotel.experienceStatus]}`}>
              {EXPERIENCE_STATUS_LABEL[hotel.experienceStatus]}
            </span>
            <Icon.ChevronRight width={14} height={14} className="text-graphite-faint" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function CreatePortfolioModal({
  hotels,
  hotelsLoading,
  submitting,
  error,
  onClose,
  onCreate
}: {
  hotels: RealHotel[];
  hotelsLoading: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (name: string, hotelIds: string[]) => void;
}) {
  const [name, setName] = useState("");
  const [selectedHotelIds, setSelectedHotelIds] = useState<string[]>([]);

  function toggleHotel(id: string) {
    setSelectedHotelIds((prev) => (prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || selectedHotelIds.length === 0) return;
    onCreate(name.trim(), selectedHotelIds);
  }

  return (
    <Modal title="Nouveau portefeuille" onClose={onClose}>
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
            {submitting ? "Création…" : "Créer le portefeuille"}
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
