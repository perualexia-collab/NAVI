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
  if (!user || !user.active) {
    reply.code(401).send({ error: "Non authentifié." });
    return null;
  }

  return { id: user.id, role: user.role };
}
