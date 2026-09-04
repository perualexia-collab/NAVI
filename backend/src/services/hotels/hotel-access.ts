/**
 * Phase G2 — retour réel 2026-09-04 : les hôtels sont redevenus un
 * catalogue partagé entre tous les comptes NAVI (dès qu'un utilisateur en
 * ajoute un, il est visible de tous). Ce fichier ne conserve donc plus
 * que le type `RequestingUser` partagé — l'ancien filtrage par
 * `Hotel.ownerId` (hotelOwnerFilter/canAccessHotel, Phase G1) a été
 * retiré ; la portée par compte s'applique désormais aux SCANS, pas aux
 * hôtels eux-mêmes (voir backend/src/services/scans/scan-access.ts et
 * getLatestScanByHotelId()). `Hotel.ownerId` reste en base comme simple
 * métadonnée de provenance (qui a ajouté l'hôtel), sans effet sur l'accès.
 */
export interface RequestingUser {
  id: string;
  role: string;
}
