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

/** Un échange déjà répondu du même fil — pour la mémoire conversationnelle (retour réel 2026-09-03). */
export interface AskNaviHistoryTurn {
  question: string;
  answer: string;
}
