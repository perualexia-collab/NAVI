/**
 * Hôtel pilote du premier vertical slice (Phase C) — reprend la valeur
 * littérale de CONFIG.hotels dans docs/reference/moteur-experience-existant.js.
 *
 * Écart relevé, non résolu : le commentaire du script d'origine dit
 * "on reste volontairement sur Baudelaire Opéra, qui déclenche P06", mais
 * la valeur réellement utilisée est CONFIG.hotels = ['Hôtel Apollinaire'].
 * Le commentaire et la donnée exécutée divergent dans le script existant
 * lui-même — j'ai retenu la valeur réellement exécutée (Hôtel Apollinaire),
 * pas le commentaire, mais je ne peux pas savoir laquelle des deux reflète
 * l'intention réelle. À confirmer si un autre hôtel de test était prévu.
 *
 * Ce fixture remplace temporairement le flux "Paramètres → Ajouter un
 * hôtel → testHotelConnection()" (Phase G, hors scope) : le statut est
 * volontairement TO_VERIFY, pas ACTIVE — aucune validation Expérience
 * réelle n'a eu lieu.
 */
export const pilotHotel = {
  id: "pilot-apollinaire",
  name: "Hôtel Apollinaire",
  experienceLabel: "Hôtel Apollinaire",
  experienceStatus: "TO_VERIFY" as const
};
