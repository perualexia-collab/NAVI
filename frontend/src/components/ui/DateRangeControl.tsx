import { useEffect, useRef, useState } from "react";
import { formatDate } from "../../lib/format.js";

const PRESETS = ["Ce mois-ci", "3 derniers mois", "12 derniers mois", "Depuis le début de l'année"] as const;
const CUSTOM = "Période personnalisée" as const;

/**
 * Sélecteur de période — retours Phase C.5 (2026-09-01) : rendu cliquable,
 * la sélection se reflète dans le libellé affiché. Ne déclenche aucun
 * nouvel appel de données : les écrans qui l'utilisent affichent encore
 * des données mockées ou un scan déjà chargé, on ne fabrique pas de
 * nouveau résultat de scan à partir d'un changement de période ici.
 */
export function DateRangeControl({ label = "1 janv. 2026 - 31 août 2026" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>(label);
  const [customMode, setCustomMode] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
        setCustomMode(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function applyCustomRange(event: React.FormEvent) {
    event.preventDefault();
    if (!customStart || !customEnd) return;
    setSelected(`${formatDate(customStart)} - ${formatDate(customEnd)}`);
    setCustomMode(false);
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
        {selected}
        <ChevronDown className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-64 rounded-lg border border-graphite/10 bg-linen py-1.5 shadow-md">
          {!customMode ? (
            <>
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setSelected(preset);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    preset === selected ? "bg-terracotta-soft text-terracotta-ink font-medium" : "text-graphite-soft hover:bg-linen-deep"
                  }`}
                >
                  {preset}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomMode(true)}
                className="block w-full px-3 py-2 text-left text-sm text-graphite-soft hover:bg-linen-deep"
              >
                {CUSTOM}
              </button>
            </>
          ) : (
            <form onSubmit={applyCustomRange} className="flex flex-col gap-2 px-3 py-2">
              <label className="flex flex-col gap-1 text-xs text-graphite-soft">
                Du
                <input
                  type="date"
                  required
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded-lg border border-graphite/20 bg-parchment-soft px-2 py-1.5 text-sm outline-none focus:border-terracotta"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-graphite-soft">
                Au
                <input
                  type="date"
                  required
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-lg border border-graphite/20 bg-parchment-soft px-2 py-1.5 text-sm outline-none focus:border-terracotta"
                />
              </label>
              <div className="mt-1 flex justify-end gap-2">
                <button type="button" onClick={() => setCustomMode(false)} className="rounded-lg px-3 py-1.5 text-xs text-graphite-soft hover:bg-linen-deep">
                  Retour
                </button>
                <button type="submit" className="rounded-lg bg-terracotta px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
                  Appliquer
                </button>
              </div>
            </form>
          )}
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
