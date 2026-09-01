import { randomBytes, createHash } from "node:crypto";

/** Durée de validité d'un lien d'activation — retours Phase C.5, §3. */
export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

/**
 * Jamais stocké en clair (comme un mot de passe) : on ne conserve que le
 * hash, le jeton brut n'existe que dans l'URL renvoyée une seule fois à la
 * création/au renvoi de l'invitation.
 */
export function generateInviteToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashInviteToken(raw), expiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS) };
}

export function hashInviteToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
