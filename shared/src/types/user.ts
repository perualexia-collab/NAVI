import type { Role } from "./common.js";

/**
 * PENDING = compte créé par un admin, mot de passe pas encore défini via le
 * lien d'activation ; ACTIVE = peut se connecter ; DISABLED = accès bloqué
 * par un admin. Retours Phase C.5 (2026-09-01).
 */
export type UserStatus = "PENDING" | "ACTIVE" | "DISABLED";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
}
