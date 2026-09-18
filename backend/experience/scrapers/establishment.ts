import type { Page } from "playwright";

/**
 * Fiche établissement (Administration → Établissement) — étoiles, nombre
 * de chambres, ville/code postal. Découvert Phase I1 (retour réel
 * 2026-09-18, script codegen fourni par l'utilisateur) : aucun lien avec
 * les scrapers Reporting existants (base.ts, marketing.ts, ...), page
 * jamais visitée avant cette phase.
 *
 * Les libellés ("Nombre de chambres", "Nombre d'étoiles", "Ville", "Code
 * postal") ne sont pas associés sémantiquement à leur champ (pas de
 * <label for>, confirmé par le script codegen qui doit passer par des
 * sélecteurs positionnels type `.nth(2)`) — même situation que le champ
 * e-mail de connexion ou les cartes CA de marketing.ts. On lit donc le
 * premier <input> qui suit le texte du libellé dans l'ordre du DOM,
 * plutôt que de deviner un index positionnel fragile.
 */
export interface EstablishmentInfo {
  stars: number | null;
  roomCount: number | null;
  city: string | null;
  postalCode: string | null;
}

async function readFieldValue(page: Page, labelText: string): Promise<string> {
  const label = page.getByText(labelText, { exact: true }).first();
  await label.waitFor({ state: "visible", timeout: 15000 });
  const input = label.locator("xpath=following::input[1]");
  return (await input.inputValue()).trim();
}

function toIntOrNull(value: string): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function scrapeEstablishmentInfo(page: Page): Promise<EstablishmentInfo> {
  // Séquentiel (pas Promise.all) — même convention que les autres
  // scrapers du projet (ex. marketing.ts) pour éviter toute interférence
  // entre lectures sur une même page.
  const roomCountRaw = await readFieldValue(page, "Nombre de chambres");
  const starsRaw = await readFieldValue(page, "Nombre d'étoiles");
  const cityRaw = await readFieldValue(page, "Ville");
  const postalCodeRaw = await readFieldValue(page, "Code postal");

  return {
    roomCount: toIntOrNull(roomCountRaw),
    stars: toIntOrNull(starsRaw),
    city: cityRaw || null,
    postalCode: postalCodeRaw || null
  };
}

/**
 * Emplacement affiché/filtrable ("Paris 6", "Lyon") — Expérience n'a pas
 * de champ arrondissement, seulement Ville + Code postal (retour réel
 * 2026-09-18) : dérivé ici plutôt que scrapé tel quel. Paris uniquement
 * (code postal 750XX) ; toute autre ville est utilisée telle quelle, sans
 * transformation.
 */
export function deriveLocation(city: string | null, postalCode: string | null): string | null {
  if (!city) return null;
  const trimmedCity = city.trim();
  if (!trimmedCity) return null;

  if (trimmedCity.toLowerCase() === "paris" && postalCode) {
    // Retour réel 2026-09-18 : un code postal parisien fait 5 chiffres
    // ("75015"), pas 4 — "75" + "0" + les 2 chiffres de l'arrondissement.
    // Le motif précédent (4 chiffres) ne matchait donc jamais un vrai code
    // postal, d'où un "Paris" sans arrondissement en pratique.
    const match = postalCode.trim().match(/^750(\d{2})$/);
    const arrondissement = match ? Number.parseInt(match[1]!, 10) : null;
    if (arrondissement !== null && arrondissement >= 1 && arrondissement <= 20) {
      return `Paris ${arrondissement}`;
    }
  }

  return trimmedCity;
}
