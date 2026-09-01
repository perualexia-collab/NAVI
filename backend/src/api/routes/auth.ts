import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { SESSION_COOKIE_NAME, verifyPassword } from "../../lib/auth.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function sanitizeUser(user: { id: string; email: string; name: string; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function authRoutes(app: FastifyInstance) {
  // Pas d'inscription publique (brief §7) — les comptes sont créés depuis Paramètres → Utilisateurs.
  app.post("/api/auth/login", async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Adresse e-mail ou mot de passe invalide." });
    }

    const user = await prisma.user.findUnique({ where: { email: body.data.email } });
    const valid = user ? await verifyPassword(user.passwordHash, body.data.password) : false;

    if (!user || !valid || !user.active) {
      // Message volontairement identique dans tous les cas d'échec — ne pas révéler
      // si l'e-mail existe.
      return reply.code(401).send({ error: "Identifiants incorrects." });
    }

    reply.setCookie(SESSION_COOKIE_NAME, user.id, {
      httpOnly: true,
      sameSite: "lax",
      signed: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7 // 7 jours
    });

    return sanitizeUser(user);
  });

  app.post("/api/auth/logout", async (request, reply) => {
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (request, reply) => {
    const raw = request.cookies[SESSION_COOKIE_NAME];
    const unsigned = raw ? request.unsignCookie(raw) : null;
    if (!unsigned?.valid || !unsigned.value) {
      return reply.code(401).send({ error: "Non authentifié." });
    }

    const user = await prisma.user.findUnique({ where: { id: unsigned.value } });
    if (!user || !user.active) {
      return reply.code(401).send({ error: "Non authentifié." });
    }

    return sanitizeUser(user);
  });
}
