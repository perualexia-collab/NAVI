import { useEffect, useRef, useState } from "react";

const PRESETS = [
  "7 derniers jours",
  "30 derniers jours",
  "3 derniers mois",
  "1 janv. 2026 - 31 août 2026"
] as const;

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

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
        <div className="absolute right-0 z-20 mt-1.5 w-56 rounded-lg border border-graphite/10 bg-linen py-1.5 shadow-md">
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
