/**
 * Portée par compte des hôtels (Phase H8, retour réel 2026-09-04) —
 * "propre à chaque compte NAVI, comme pour les portefeuilles"
 * (Portfolio.ownerId). Un ADMIN voit/gère tous les hôtels (décision
 * explicite : cohérent avec la gestion des utilisateurs, déjà org-wide
 * pour les admins) ; un utilisateur normal ne voit que les siens.
 */
export interface RequestingUser {
  id: string;
  role: string;
}

/** Fragment `where` Prisma — {} pour un admin (aucun filtre), sinon `{ ownerId }`. */
export function hotelOwnerFilter(user: RequestingUser): { ownerId?: string } {
  return user.role === "ADMIN" ? {} : { ownerId: user.id };
}

/** Un hôtel orphelin (ownerId null — créé avant ce champ) n'est accessible qu'à un admin. */
export function canAccessHotel(hotel: { ownerId: string | null }, user: RequestingUser): boolean {
  return user.role === "ADMIN" || hotel.ownerId === user.id;
}
