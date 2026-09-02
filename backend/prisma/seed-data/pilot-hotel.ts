/**
 * Hôtel pilote du premier vertical slice réel (Phase C, clôture) —
 * "Hôtel Louis II", choisi explicitement par l'utilisateur pour le
 * premier test réel contre Expérience (2026-09-02), en remplacement de
 * "Hôtel Apollinaire" (jamais testé en réel — script d'origine ambigu
 * entre Apollinaire et "Baudelaire Opéra", jamais résolu, cf.
 * docs/reference/phase-c-real-connection-notes.md).
 *
 * experienceLabel = libellé exact confirmé par l'utilisateur directement
 * dans Expérience le 2026-09-02 ("Louis II", sans le préfixe "Hôtel" —
 * différent du nom NAVI) ; selectHotel() fait une recherche en
 * correspondance exacte, donc cette valeur doit rester synchronisée avec
 * Expérience.
 *
 * Le statut reste TO_VERIFY, pas ACTIVE : le libellé est confirmé par
 * l'utilisateur mais pas encore par un scan réel réussi (selectHotel()
 * pas encore exécuté contre le vrai DOM).
 */
export const pilotHotel = {
  id: "pilot-louis-ii",
  name: "Hôtel Louis II",
  experienceLabel: "Louis II",
  experienceStatus: "TO_VERIFY" as const
};
