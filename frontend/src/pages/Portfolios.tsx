import { useMemo, useState } from "react";
import { Card } from "../components/ui/Card.js";
import { ScoreRing } from "../components/ui/ScoreRing.js";
import { Modal } from "../components/ui/Modal.js";
import { TrendLabel } from "../components/ui/StatusPill.js";
import { DateRangeControl } from "../components/ui/DateRangeControl.js";
import { Icon } from "../components/ui/icons.js";
import { HotelsTable } from "../components/HotelsTable.js";
import { hotels as allHotels, hotelsByPortfolio, portfolios as initialPortfolios } from "../mock/data.js";
import type { MockHotel, MockPortfolio } from "../mock/types.js";

const STATUS_FILTERS = ["Tous les statuts", "Excellent", "Sain", "À surveiller", "Critique", "Aucun scan"] as const;

export function Portfolios() {
  const [portfolios, setPortfolios] = useState<MockPortfolio[]>(initialPortfolios);
  // Hôtels choisis pour chaque portefeuille créé dans cette passe — les
  // hôtels mockés existants ne sont pas réassignés (on ne touche pas à la
  // composition des portefeuilles déjà mockés, retours Phase C.5, §C).
  const [customMembers, setCustomMembers] = useState<Record<string, string[]>>({});
  const [selectedId, setSelectedId] = useState(portfolios[0]!.id);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("Tous les statuts");
  const [modalOpen, setModalOpen] = useState(false);

  const selected = portfolios.find((p) => p.id === selectedId) ?? portfolios[0]!;

  const hotels = useMemo(() => {
    const base = customMembers[selected.id]
      ? allHotels.filter((h) => customMembers[selected.id]!.includes(h.id))
      : hotelsByPortfolio(selected.id);
    return base.filter((hotel) => {
      const matchesSearch = hotel.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "Tous les statuts" || hotel.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [selected.id, customMembers, search, statusFilter]);

  function handleCreate(newPortfolio: MockPortfolio, hotelIds: string[]) {
    setPortfolios((prev) => [...prev, newPortfolio]);
    setCustomMembers((prev) => ({ ...prev, [newPortfolio.id]: hotelIds }));
    setSelectedId(newPortfolio.id);
    setModalOpen(false);
  }

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
        {portfolios.map((portfolio) => {
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
        </div>

        {hotels.length === 0 ? (
          <p className="py-6 text-center text-sm text-graphite-faint">Aucun hôtel dans ce portefeuille pour l'instant.</p>
        ) : (
          <HotelsTable hotels={hotels} />
        )}
      </Card>

      {modalOpen && <CreatePortfolioModal onClose={() => setModalOpen(false)} onCreate={handleCreate} />}
    </div>
  );
}

function CreatePortfolioModal({
  onClose,
  onCreate
}: {
  onClose: () => void;
  onCreate: (portfolio: MockPortfolio, hotelIds: string[]) => void;
}) {
  const [name, setName] = useState("");
  const [selectedHotelIds, setSelectedHotelIds] = useState<string[]>([]);

  function toggleHotel(id: string) {
    setSelectedHotelIds((prev) => (prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || selectedHotelIds.length === 0) return;
    onCreate(
      {
        id: `p-local-${Date.now()}`,
        name: name.trim(),
        hotelCount: selectedHotelIds.length,
        healthScore: null,
        healthDelta: 0,
        scannedCount: 0,
        toScanCount: selectedHotelIds.length,
        criticalCount: 0
      },
      selectedHotelIds
    );
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
          <div className="max-h-52 overflow-y-auto rounded-lg border border-graphite/15">
            {allHotels.map((hotel: MockHotel) => (
              <label key={hotel.id} className="flex items-center gap-2 border-b border-graphite/5 px-3 py-2 text-sm last:border-0 hover:bg-linen-deep">
                <input
                  type="checkbox"
                  checked={selectedHotelIds.includes(hotel.id)}
                  onChange={() => toggleHotel(hotel.id)}
                  className="rounded border-graphite/30"
                />
                <span className="flex-1">{hotel.name}</span>
                <span className="text-xs text-graphite-faint">{hotel.city}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-graphite-soft hover:bg-linen-deep">
            Annuler
          </button>
          <button
            type="submit"
            disabled={!name.trim() || selectedHotelIds.length === 0}
            className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Créer le portefeuille
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
