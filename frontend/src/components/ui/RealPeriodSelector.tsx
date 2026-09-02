import { useEffect, useRef, useState } from "react";
import { formatDate } from "../../lib/format.js";
import type { PeriodPresetValue, RealScanPeriod } from "../../lib/real-hotel-types.js";

const PERIOD_OPTIONS: { value: PeriodPresetValue; label: string }[] = [
  { value: "last12Months", label: "12 derniers mois" },
  { value: "thisYear", label: "Cette année" },
  { value: "thisMonth", label: "Ce mois-ci" },
  { value: "lastMonth", label: "Le mois dernier" }
];

export const PERIOD_LABEL: Record<PeriodPresetValue, string> = Object.fromEntries(
  PERIOD_OPTIONS.map((option) => [option.value, option.label])
) as Record<PeriodPresetValue, string>;

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, date.getDate());
}

/** Bornes de date d'un préréglage, pour affichage — reflète ce que le moteur Playwright demandera à Expérience (backend/experience/core/config.ts). */
export function computePeriodRange(value: PeriodPresetValue): { start: Date; end: Date } {
  const now = new Date();
  switch (value) {
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

export function periodLabel(period: RealScanPeriod): string {
  if (period.mode === "preset") return PERIOD_LABEL[period.value];
  return `${formatDate(period.startDate)} → ${formatDate(period.endDate)}`;
}

/**
 * Sélecteur de période réel — retours utilisateur Phase D (2026-09-02) :
 * préréglages confirmés contre le vrai sélecteur "Déterminer un
 * préréglage" d'Expérience (docs/reference/phase-d-notes.md), plus une
 * période personnalisée avec dates modifiables à la main (pas de champ
 * "Date de création", pas de bouton "Appliquer" — modifier une date bascule
 * immédiatement en période personnalisée). Utilisé partout où un scan réel
 * se lance (hôtel, portefeuille) pour rester cohérent sur toute l'app.
 */
export function RealPeriodSelector({ value, onChange }: { value: RealScanPeriod; onChange: (period: RealScanPeriod) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const { start, end } = value.mode === "preset" ? computePeriodRange(value.value) : { start: parseInputValue(value.startDate), end: parseInputValue(value.endDate) };

  function updateStart(newValue: string) {
    if (!newValue) return;
    const currentEnd = value.mode === "custom" ? value.endDate : toInputValue(computePeriodRange(value.value).end);
    onChange({ mode: "custom", startDate: newValue, endDate: currentEnd });
  }

  function updateEnd(newValue: string) {
    if (!newValue) return;
    const currentStart = value.mode === "custom" ? value.startDate : toInputValue(computePeriodRange(value.value).start);
    onChange({ mode: "custom", startDate: currentStart, endDate: newValue });
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
        {periodLabel(value)}
        <ChevronDown className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1.5 w-72 rounded-lg border border-graphite/10 bg-linen p-3 shadow-md">
          <div className="flex flex-col gap-0.5">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ mode: "preset", value: option.value })}
                className={`rounded-md px-2.5 py-1.5 text-left text-sm ${
                  value.mode === "preset" && value.value === option.value
                    ? "bg-terracotta-soft text-terracotta-ink font-medium"
                    : "text-graphite-soft hover:bg-linen-deep"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-2.5 flex flex-col gap-2 border-t border-graphite/10 pt-2.5">
            <div className={`text-xs font-medium ${value.mode === "custom" ? "text-terracotta-ink" : "text-graphite-soft"}`}>Période personnalisée</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-graphite-soft">
                Du
                <input
                  type="date"
                  value={toInputValue(start)}
                  onChange={(e) => updateStart(e.target.value)}
                  className="rounded-lg border border-graphite/20 bg-parchment-soft px-2 py-1.5 text-sm outline-none focus:border-terracotta"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-graphite-soft">
                Au
                <input
                  type="date"
                  value={toInputValue(end)}
                  onChange={(e) => updateEnd(e.target.value)}
                  className="rounded-lg border border-graphite/20 bg-parchment-soft px-2 py-1.5 text-sm outline-none focus:border-terracotta"
                />
              </label>
            </div>
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
