import type { AskNaviIntent } from "./route-intent.js";

export interface AskNaviSource {
  label: string;
  detail: string;
}

export interface AskNaviAnswer {
  answer: string;
  intent: AskNaviIntent["type"];
  sources: AskNaviSource[];
}
