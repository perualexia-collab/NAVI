import type { Locator, Page } from "playwright";

/** Statistiques Marketing — porté depuis scrapeMarketingKPIs() (bloc 3/8). */
export interface MarketingKpis {
  total: { revenue: number; bookings: number };
  campaigns: { revenue: number; bookings: number };
  automations: { revenue: number; bookings: number };
}

async function readMarketingMetric(labelLocator: Locator, type: "currency" | "number"): Promise<number> {
  await labelLocator.waitFor({ state: "visible", timeout: 15000 });

  const cardText = await labelLocator.evaluate((element, metricType) => {
    let current: Element | null = element;
    for (let i = 0; i < 8; i++) {
      if (!current) break;
      const text = ((current as HTMLElement).innerText || "").replace(/ /g, " ").trim();

      if (metricType === "currency" && /Chiffre d'affaires/i.test(text) && /\d[\d\s]*[,.]\d{2}\s*€/.test(text)) {
        return text;
      }

      if (metricType === "number" && /Nombre de réservations/i.test(text)) {
        const withoutLabel = text.replace(/Nombre de réservations/i, "");
        if (/\d/.test(withoutLabel)) return text;
      }

      current = current.parentElement;
    }
    return "";
  }, type);

  if (!cardText) throw new Error(`Carte KPI marketing introuvable (${type})`);

  const normalized = cardText.replace(/ /g, " ").replace(/\n+/g, " ").trim();

  if (type === "currency") {
    const currencyMatch = normalized.match(/(\d[\d\s]*[,.]\d{2})\s*€/);
    if (!currencyMatch) throw new Error(`CA introuvable : ${normalized}`);
    return Number(currencyMatch[1]!.replace(/\s/g, "").replace(",", "."));
  }

  const withoutLabel = normalized.replace(/Nombre de réservations/i, "");
  const numberMatch = withoutLabel.match(/\d[\d\s]*/);
  if (!numberMatch) throw new Error(`Réservations introuvables : ${normalized}`);
  return Number(numberMatch[0].replace(/\s/g, ""));
}

export async function scrapeMarketingKPIs(page: Page): Promise<MarketingKpis> {
  const revenueLabels = page.getByText("Chiffre d'affaires", { exact: true });
  const bookingLabels = page.getByText("Nombre de réservations", { exact: true });

  const revenueCount = await revenueLabels.count();
  const bookingCount = await bookingLabels.count();

  if (revenueCount < 3) throw new Error(`Pas assez de cartes CA : ${revenueCount}`);
  if (bookingCount < 4) throw new Error(`Pas assez de cartes réservations : ${bookingCount}`);

  const totalRevenue = await readMarketingMetric(revenueLabels.nth(0), "currency");
  const totalBookings = await readMarketingMetric(bookingLabels.nth(0), "number");
  const campaignRevenue = await readMarketingMetric(revenueLabels.nth(1), "currency");
  const campaignBookings = await readMarketingMetric(bookingLabels.nth(2), "number");
  const automationRevenue = await readMarketingMetric(revenueLabels.nth(2), "currency");
  const automationBookings = await readMarketingMetric(bookingLabels.nth(3), "number");

  return {
    total: { revenue: totalRevenue, bookings: totalBookings },
    campaigns: { revenue: campaignRevenue, bookings: campaignBookings },
    automations: { revenue: automationRevenue, bookings: automationBookings }
  };
}
