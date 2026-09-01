import type { Page } from "playwright";
import { evolutionPoints } from "./parsing.js";

/** Dépendance OTA — porté depuis scrapeRevenueOTAKPIs() et alentours (bloc 3/8). */

interface YearShare {
  N: number;
  N1: number;
}

interface ChannelShare {
  reservationShare: YearShare;
  revenueShare: YearShare;
  reservationEvolution: number | null;
  revenueEvolution: number | null;
}

export interface OtaKpis {
  yearN: number;
  yearN1: number;
  booking: ChannelShare;
  expedia: ChannelShare;
  nonOta: ChannelShare;
}

/**
 * Lit un graphique Highcharts en triant les éléments texte du SVG par
 * position — heuristique fragile signalée à l'audit (NAVI Architecture
 * Proposal §02/§10) : tout changement de mise en page côté Expérience peut
 * la casser silencieusement. Conservée telle quelle pour ce vertical slice.
 */
async function readHighchartShares(page: Page, chartTitle: string, yearN: number, yearN1: number): Promise<YearShare> {
  const title = page.getByRole("strong").filter({ hasText: chartTitle }).first();
  await title.waitFor({ state: "visible", timeout: 20000 });

  const chart = title.locator('xpath=ancestor::*[.//*[contains(@class,"highcharts-container")]][1]');
  const svg = chart.locator("svg.highcharts-root").first();
  await svg.waitFor({ state: "visible", timeout: 20000 });

  const elements = await svg.locator("text").evaluateAll((nodes) =>
    nodes.map((el) => {
      const box = el.getBoundingClientRect();
      return { text: (el.textContent || "").trim(), x: box.left + box.width / 2, y: box.top + box.height / 2 };
    })
  );

  function yearPosition(year: number) {
    return elements.filter((item) => item.text === String(year)).sort((a, b) => b.y - a.y)[0];
  }

  const yearNElement = yearPosition(yearN);
  const yearN1Element = yearPosition(yearN1);
  if (!yearNElement || !yearN1Element) throw new Error(`Années introuvables : ${chartTitle}`);

  const percentages = elements
    .map((item) => {
      const match = item.text.match(/(\d+(?:[.,]\d+)?)\s*%/);
      if (!match) return null;
      return { value: Number(match[1]!.replace(",", ".")), x: item.x };
    })
    .filter((v): v is { value: number; x: number } => v !== null);

  function closest(yearElement: { x: number }) {
    return [...percentages].sort((a, b) => Math.abs(a.x - yearElement.x) - Math.abs(b.x - yearElement.x))[0];
  }

  const current = closest(yearNElement);
  const previous = closest(yearN1Element);
  if (!current || !previous) throw new Error(`Pourcentages introuvables : ${chartTitle}`);

  return { N: current.value, N1: previous.value };
}

async function scrapeRevenueChannel(
  page: Page,
  config: { tabName: string; reservationTitle: string; revenueTitle: string },
  yearN: number,
  yearN1: number
): Promise<ChannelShare> {
  const tab = page.getByRole("button", { name: config.tabName, exact: true });
  await tab.waitFor({ state: "visible", timeout: 20000 });
  await tab.click();
  await page.waitForTimeout(1200);

  const reservationShare = await readHighchartShares(page, config.reservationTitle, yearN, yearN1);
  const revenueShare = await readHighchartShares(page, config.revenueTitle, yearN, yearN1);

  return {
    reservationShare,
    revenueShare,
    reservationEvolution: evolutionPoints(reservationShare.N, reservationShare.N1),
    revenueEvolution: evolutionPoints(revenueShare.N, revenueShare.N1)
  };
}

/**
 * IMPORTANT — non filtrable par la période du scan (brief §18) : ces
 * parts comparent toujours l'année civile en cours à l'année précédente,
 * quelle que soit la période sélectionnée par l'utilisateur. Reflété dans
 * KPIDefinition.dateFilterable = false pour ces KPI (backend/prisma/seed-data).
 */
export async function scrapeRevenueOTAKPIs(page: Page): Promise<OtaKpis> {
  const yearN = new Date().getFullYear();
  const yearN1 = yearN - 1;

  const booking = await scrapeRevenueChannel(
    page,
    { tabName: "Booking.com", reservationTitle: "Part des réservations Booking", revenueTitle: "Part du CA Booking.com / CA" },
    yearN,
    yearN1
  );

  const expedia = await scrapeRevenueChannel(
    page,
    { tabName: "Expedia", reservationTitle: "Part des réservations Expedia", revenueTitle: "Part du CA Expedia / CA Total" },
    yearN,
    yearN1
  );

  const nonOta = await scrapeRevenueChannel(
    page,
    { tabName: "Non OTA", reservationTitle: "Part des réservations Non OTA", revenueTitle: "Part du CA Non OTA / CA Total" },
    yearN,
    yearN1
  );

  return { yearN, yearN1, booking, expedia, nonOta };
}
