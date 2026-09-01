import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db/prisma.js";
import { SESSION_COOKIE_NAME } from "../lib/auth.js";

/** Résout l'utilisateur courant depuis le cookie de session, ou répond 401. Contrôle des droits toujours côté backend (brief §40). */
export async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<{ id: string; role: string } | null> {
  const raw = request.cookies[SESSION_COOKIE_NAME];
  const unsigned = raw ? request.unsignCookie(raw) : null;
  if (!unsigned?.valid || !unsigned.value) {
    reply.code(401).send({ error: "Non authentifié." });
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: unsigned.value } });
  if (!user || user.status !== "ACTIVE") {
    reply.code(401).send({ error: "Non authentifié." });
    return null;
  }

  return { id: user.id, role: user.role };
}

/**
 * Comme requireUser, mais exige en plus le rôle ADMIN — gestion des
 * utilisateurs NAVI réservée aux admins (retours Phase C.5, §6).
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<{ id: string; role: string } | null> {
  const user = await requireUser(request, reply);
  if (!user) return null;
  if (user.role !== "ADMIN") {
    reply.code(403).send({ error: "Réservé aux administrateurs." });
    return null;
  }
  return user;
}
