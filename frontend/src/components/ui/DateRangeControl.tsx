import { useEffect, useRef, useState, type FormEvent } from "react";

const PRESETS = ["Ce mois-ci", "3 derniers mois", "12 derniers mois", "Depuis le début de l'année"] as const;
type Preset = (typeof PRESETS)[number];

const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function formatDateLabel(d: Date): string {
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function toInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// new Date("YYYY-MM-DD") parse en UTC minuit — mauvaise date une fois relue
// en heure locale selon le fuseau. On construit la Date nous-mêmes.
function parseInputValue(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/**
 * Calcule les dates de début/fin d'une période prédéfinie, comme dans
 * Expérience — retours Phase C.5 (2ᵉ passe) : "12 derniers mois" doit
 * immédiatement renseigner début = aujourd'hui - 12 mois, fin = aujourd'hui.
 */
function computeRange(preset: Preset): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  switch (preset) {
    case "Ce mois-ci":
      start.setDate(1);
      break;
    case "3 derniers mois":
      start.setMonth(start.getMonth() - 3);
      break;
    case "12 derniers mois":
      start.setMonth(start.getMonth() - 12);
      break;
    case "Depuis le début de l'année":
      start.setMonth(0, 1);
      break;
  }
  return { start, end };
}

/**
 * Sélecteur de période — reprend la logique d'Expérience : choisir une
 * période prédéfinie renseigne immédiatement les dates de début/fin
 * correspondantes (modifiables ensuite à la main), ou saisie manuelle
 * directe. Ne déclenche aucun nouvel appel de données : on ne fabrique pas
 * de résultat de scan pour la période choisie ici.
 */
export function DateRangeControl({ label = "1 janv. 2026 - 31 août 2026" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<Preset | null>(null);
  const [rangeLabel, setRangeLabel] = useState(label);
  const [startValue, setStartValue] = useState("");
  const [endValue, setEndValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectPreset(preset: Preset) {
    const { start, end } = computeRange(preset);
    setStartValue(toInputValue(start));
    setEndValue(toInputValue(end));
    setActivePreset(preset);
  }

  function applyRange(event: FormEvent) {
    event.preventDefault();
    if (!startValue || !endValue) return;
    setRangeLabel(`${formatDateLabel(parseInputValue(startValue))} - ${formatDateLabel(parseInputValue(endValue))}`);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-graphite/15 bg-linen px-3 py-2 text-sm text-graphite-soft hover:border-graphite/30"
      >
        <CalendarIcon />
        {rangeLabel}
        <ChevronDown className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-72 rounded-lg border border-graphite/10 bg-linen p-3 shadow-md">
          <div className="mb-2.5 flex flex-col gap-0.5">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => selectPreset(preset)}
                className={`rounded-md px-2.5 py-1.5 text-left text-sm ${
                  preset === activePreset ? "bg-terracotta-soft text-terracotta-ink font-medium" : "text-graphite-soft hover:bg-linen-deep"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <form onSubmit={applyRange} className="flex flex-col gap-2 border-t border-graphite/10 pt-2.5">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-graphite-soft">
                Du
                <input
                  type="date"
                  required
                  value={startValue}
                  onChange={(e) => {
                    setStartValue(e.target.value);
                    setActivePreset(null);
                  }}
                  className="rounded-lg border border-graphite/20 bg-parchment-soft px-2 py-1.5 text-sm outline-none focus:border-terracotta"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-graphite-soft">
                Au
                <input
                  type="date"
                  required
                  value={endValue}
                  onChange={(e) => {
                    setEndValue(e.target.value);
                    setActivePreset(null);
                  }}
                  className="rounded-lg border border-graphite/20 bg-parchment-soft px-2 py-1.5 text-sm outline-none focus:border-terracotta"
                />
              </label>
            </div>
            <button type="submit" className="self-end rounded-lg bg-terracotta px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
              Appliquer
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${className}`}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
