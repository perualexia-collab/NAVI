import type { Page } from "playwright";
import { evolutionPoints } from "./parsing.js";

/**
 * Returning Guests — porté depuis scrapeReturningGuests() (bloc 3/8).
 * IMPORTANT : à appeler après openRevenue(page). Non filtrable par la
 * période du scan (année N vs N-1 fixe) — même remarque que scrapers/ota.ts.
 */
export interface ReturningGuestsKpis {
  yearN: number;
  yearN1: number;
  N: number;
  N1: number;
  evolution: number | null;
}

export async function scrapeReturningGuests(page: Page): Promise<ReturningGuestsKpis> {
  const yearN = new Date().getFullYear();
  const yearN1 = yearN - 1;

  const tab = page.getByRole("link", { name: /Returning guests/i });
  await tab.waitFor({ state: "visible", timeout: 20000 });
  await tab.click();
  await page.waitForTimeout(1200);

  const title = page.getByText(/Le pourcentage de Returning/i).first();
  await title.waitFor({ state: "visible", timeout: 20000 });

  const svg = page.locator("svg.highcharts-root").first();
  await svg.waitFor({ state: "visible", timeout: 20000 });

  const elements = await svg.locator("text").evaluateAll((nodes) =>
    nodes.map((el) => {
      const box = el.getBoundingClientRect();
      return { text: (el.textContent || "").trim(), x: box.left + box.width / 2, y: box.top + box.height / 2 };
    })
  );

  function getYear(year: number) {
    return elements.filter((item) => item.text === String(year)).sort((a, b) => b.y - a.y)[0];
  }

  const posN = getYear(yearN);
  const posN1 = getYear(yearN1);
  if (!posN || !posN1) throw new Error("Années Returning Guests introuvables");

  const percentages = elements
    .map((item) => {
      const match = item.text.match(/(\d+(?:[.,]\d+)?)\s*%/);
      if (!match) return null;
      return { value: Number(match[1]!.replace(",", ".")), x: item.x };
    })
    .filter((v): v is { value: number; x: number } => v !== null);

  function closest(pos: { x: number }) {
    return [...percentages].sort((a, b) => Math.abs(a.x - pos.x) - Math.abs(b.x - pos.x))[0];
  }

  const current = closest(posN);
  const previous = closest(posN1);
  if (!current || !previous) throw new Error("Valeurs Returning Guests introuvables");

  return { yearN, yearN1, N: current.value, N1: previous.value, evolution: evolutionPoints(current.value, previous.value) };
}
