import type { Page } from "playwright";

/** Captation e-mail — porté depuis scrapeEmailCapture() (bloc 3/8). */
export interface EmailCaptureKpis {
  displayedRate: number;
  capturedEmails: number;
  captureBase: number;
  calculatedRate: number | null;
}

export async function scrapeEmailCapture(page: Page): Promise<EmailCaptureKpis> {
  const label = page.getByRole("paragraph").filter({ hasText: "Captation d'e-mail" }).first();
  await label.waitFor({ state: "visible", timeout: 20000 });

  const cardText = await label.evaluate((element) => {
    let current: Element | null = element;
    for (let i = 0; i < 10; i++) {
      if (!current) break;
      const text = (current as HTMLElement).innerText || "";
      if (/Captation d['’]e-mail/i.test(text) && /\d+(?:[.,]\d+)?\s*%/.test(text) && /\d[\d\s]*\s*\/\s*\d[\d\s]*/.test(text)) {
        return text;
      }
      current = current.parentElement;
    }
    return "";
  });

  const normalized = cardText.replace(/ /g, " ").replace(/\n+/g, " ");
  const percent = normalized.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const ratio = normalized.match(/(\d[\d\s]*)\s*\/\s*(\d[\d\s]*)/);

  if (!percent || !ratio) throw new Error("Captation e-mail illisible");

  const displayedRate = Number(percent[1]!.replace(",", "."));
  const capturedEmails = Number(ratio[1]!.replace(/\s/g, ""));
  const captureBase = Number(ratio[2]!.replace(/\s/g, ""));
  const calculatedRate = captureBase > 0 ? (capturedEmails / captureBase) * 100 : null;

  return {
    displayedRate,
    capturedEmails,
    captureBase,
    calculatedRate: calculatedRate === null ? null : Math.round((calculatedRate + Number.EPSILON) * 100) / 100
  };
}
