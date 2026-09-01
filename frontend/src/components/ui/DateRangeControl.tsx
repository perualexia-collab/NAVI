/**
 * Sélecteur de période — affichage uniquement en Phase B (donnée mockée).
 * Le vrai composant (préréglages + période personnalisée, brief §18) sera
 * branché en Phase C, avec la distinction KPI filtrables/non filtrables.
 */
export function DateRangeControl({ label = "1 janv. 2026 - 31 août 2026" }: { label?: string }) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-lg border border-graphite/15 bg-linen px-3 py-2 text-sm text-graphite-soft"
    >
      <CalendarIcon />
      {label}
      <ChevronDown />
    </button>
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

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
