import type { RequestingUser } from "../hotels/hotel-access.js";

/**
 * Portée par compte des SCANS (Phase G2, retour réel 2026-09-04) —
 * distinct de l'accès aux hôtels (redevenus un catalogue partagé, voir
 * hotel-access.ts) : "si on n'a pas fait de scan sur ce compte-là, il
 * n'est pas censé y en avoir". Un admin voit/gère les scans de tout le
 * monde.
 */
export function canAccessScan(scan: { requestedById: string }, user: RequestingUser): boolean {
  return user.role === "ADMIN" || scan.requestedById === user.id;
}
