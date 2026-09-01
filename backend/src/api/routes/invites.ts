import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { hashPassword } from "../../lib/auth.js";
import { hashInviteToken } from "../../lib/invite-tokens.js";

const activateSchema = z.object({
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères.")
});

/**
 * Routes publiques (pas de session requise — le jeton lui-même est le
 * justificatif) pour le parcours d'activation de compte — retours Phase
 * C.5 (§3). Le jeton brut n'est jamais stocké : on compare son hash.
 */
export async function invitesRoutes(app: FastifyInstance) {
  app.get("/api/invites/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    const invite = await prisma.inviteToken.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      include: { user: true }
    });

    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      return reply.code(404).send({ error: "Lien d'invitation invalide ou expiré." });
    }

    return { email: invite.user.email, name: invite.user.name };
  });

  app.post("/api/invites/:token/activate", async (request, reply) => {
    const { token } = request.params as { token: string };
    const body = activateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0]?.message ?? "Requête invalide." });
    }

    const invite = await prisma.inviteToken.findUnique({ where: { tokenHash: hashInviteToken(token) } });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      return reply.code(404).send({ error: "Lien d'invitation invalide ou expiré." });
    }

    const passwordHash = await hashPassword(body.data.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: invite.userId }, data: { passwordHash, status: "ACTIVE" } }),
      prisma.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } })
    ]);

    return { ok: true };
  });
}
