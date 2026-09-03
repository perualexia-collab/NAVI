/**
 * P11 — scoring relatif des opportunités, porté à l'identique depuis
 * docs/reference/moteur-experience-existant.js (bloc 1/8 : getVolumeScore,
 * getOpportunityLevel, calculateOpportunityScore). Fonctions pures, aucune
 * dépendance au DOM — seuils/barèmes verrouillés, ne pas modifier sans
 * mettre à jour le référentiel d'abord (même règle que crm-health.ts).
 */

export function getVolumeScore(recipients: number): number {
  if (recipients < 100) return 0;
  if (recipients < 250) return 10;
  if (recipients < 500) return 20;
  if (recipients < 1000) return 30;
  if (recipients < 2000) return 40;
  return 50;
}

export function getOpportunityLevel(score: number): string {
  if (score < 40) return "Opportunité marginale";
  if (score < 60) return "Opportunité secondaire";
  if (score < 75) return "Opportunité intéressante";
  if (score < 90) return "Opportunité forte";
  return "Opportunité prioritaire";
}

export interface OpportunityScore {
  volumeScore: number;
  potentialScore: number;
  actionabilityScore: number;
  totalScore: number;
  level: string;
}

export function calculateOpportunityScore(opportunity: { potentialScore: number; actionabilityScore: number }, recipients: number): OpportunityScore {
  // Écart volontaire au barème d'origine (décision produit du 2026-09-03,
  // pas une correction de seuil) : à 0 destinataire, potentialScore et
  // actionabilityScore (poids fixes du référentiel) donnaient quand même
  // un score type 45/100 ("Opportunité secondaire"), alors qu'il n'y a
  // littéralement personne à cibler.
  if (recipients === 0) {
    return { volumeScore: 0, potentialScore: 0, actionabilityScore: 0, totalScore: 0, level: "Opportunité absente" };
  }

  const volumeScore = getVolumeScore(recipients);
  const totalScore = volumeScore + opportunity.potentialScore + opportunity.actionabilityScore;

  return {
    volumeScore,
    potentialScore: opportunity.potentialScore,
    actionabilityScore: opportunity.actionabilityScore,
    totalScore,
    level: getOpportunityLevel(totalScore)
  };
}
