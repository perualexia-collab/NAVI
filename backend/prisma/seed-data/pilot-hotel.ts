/**
 * Hôtel pilote du premier vertical slice réel (Phase C, clôture) —
 * "Hôtel Louis II", choisi explicitement par l'utilisateur pour le
 * premier test réel contre Expérience (2026-09-02), en remplacement de
 * "Hôtel Apollinaire" (jamais testé en réel — script d'origine ambigu
 * entre Apollinaire et "Baudelaire Opéra", jamais résolu, cf.
 * docs/reference/phase-c-real-connection-notes.md).
 *
 * experienceLabel reprend le nom NAVI comme hypothèse de départ — à
 * confirmer contre le libellé exact affiché dans Expérience avant le
 * premier scan réel (selectHotel() fait une recherche en correspondance
 * exacte) ; corriger cette valeur ici si le libellé réel diffère.
 *
 * Le statut est volontairement TO_VERIFY, pas ACTIVE : aucune validation
 * Expérience réelle n'a encore eu lieu.
 */
export const pilotHotel = {
  id: "pilot-louis-ii",
  name: "Hôtel Louis II",
  experienceLabel: "Hôtel Louis II",
  experienceStatus: "TO_VERIFY" as const
};
