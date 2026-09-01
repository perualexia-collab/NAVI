/** Parsing FR (nombres, pourcentages) — porté à l'identique depuis le bloc 3/8 du script existant. */

export function parseNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value)
    .replace(/ /g, " ")
    .replace(/\s/g, "");
  const match = normalized.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePercentage(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/ /g, " ");
  const match = normalized.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
  if (!match) return null;
  return Number(match[1]!.replace(",", "."));
}

export function evolutionPoints(current: number | null, previous: number | null): number | null {
  if (!Number.isFinite(Number(current)) || !Number.isFinite(Number(previous))) return null;
  return Math.round((Number(current) - Number(previous) + Number.EPSILON) * 100) / 100;
}
