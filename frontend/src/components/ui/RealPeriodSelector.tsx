import { useEffect, useRef, useState } from "react";
import { formatDate } from "../../lib/format.js";
import type { ScanPeriodValue } from "../../lib/real-hotel-types.js";

const PERIOD_OPTIONS: { value: ScanPeriodValue; label: string }[] = [
  { value: "last3Months", label: "3 derniers mois" },
  { value: "last6Months", label: "6 derniers mois" },
  { value: "last12Months", label: "12 derniers mois" },
  { value: "thisYear", label: "Cette année" },
  { value: "thisMonth", label: "Ce mois-ci" },
  { value: "lastMonth", label: "Le mois dernier" }
];

export const PERIOD_LABEL: Record<ScanPeriodValue, string> = Object.fromEntries(
  PERIOD_OPTIONS.map((option) => [option.value, option.label])
) as Record<ScanPeriodValue, string>;

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, date.getDate());
}

/**
 * Bornes de date d'un préréglage, pour affichage seulement — reflète ce
 * que le moteur Playwright va effectivement demander à Expérience via
 * `PERIOD_PRESETS` (backend/experience/core/config.ts), pas un filtrage
 * local.
 */
export function computePeriodRange(value: ScanPeriodValue): { start: Date; end: Date } {
  const now = new Date();
  switch (value) {
    case "last3Months":
      return { start: addMonths(now, -3), end: now };
    case "last6Months":
      return { start: addMonths(now, -6), end: now };
    case "last12Months":
      return { start: addMonths(now, -12), end: now };
    case "thisYear":
      return { start: new Date(now.getFullYear(), 0, 1), end: now };
    case "thisMonth":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    case "lastMonth":
      return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0) };
  }
}

/**
 * Sélecteur de période réel — retours utilisateur Phase D (2026-09-02) :
 * préréglages confirmés contre le vrai sélecteur "Déterminer un
 * préréglage" d'Expérience (docs/reference/phase-d-notes.md), et aperçu
 * de plage de dates mis à jour immédiatement au choix d'un préréglage
 * (pas de champ "Date de création", pas de saisie manuelle — la période
 * personnalisée n'est pas supportée par le moteur Playwright à ce
 * stade). Utilisé partout où un scan réel se lance (hôtel, portefeuille)
 * pour rester cohérent sur toute l'app.
 */
export function RealPeriodSelector({ value, onChange }: { value: ScanPeriodValue; onChange: (value: ScanPeriodValue) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const { start, end } = computePeriodRange(value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-graphite/15 bg-linen px-3 py-2 text-sm text-graphite-soft hover:border-graphite/30"
      >
        <CalendarIcon />
        {PERIOD_LABEL[value]}
        <ChevronDown className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1.5 w-64 rounded-lg border border-graphite/10 bg-linen p-3 shadow-md">
          <div className="flex flex-col gap-0.5">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`rounded-md px-2.5 py-1.5 text-left text-sm ${
                  option.value === value ? "bg-terracotta-soft text-terracotta-ink font-medium" : "text-graphite-soft hover:bg-linen-deep"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-2.5 border-t border-graphite/10 pt-2.5 text-xs text-graphite-faint">
            {formatDate(start.toISOString())} → {formatDate(end.toISOString())}
          </div>
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
