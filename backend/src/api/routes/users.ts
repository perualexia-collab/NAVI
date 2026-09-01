import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAdmin } from "../require-auth.js";
import { generateInviteToken } from "../../lib/invite-tokens.js";

const createUserSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis."),
  lastName: z.string().trim().min(1, "Nom requis."),
  email: z.string().trim().email("Adresse e-mail invalide."),
  role: z.enum(["ADMIN", "USER"]).default("USER")
});

function sanitizeUser(user: { id: string; email: string; name: string; role: string; status: string; createdAt: Date }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status, createdAt: user.createdAt };
}

/**
 * Gestion des utilisateurs NAVI — retours Phase C.5 (§3, §4, §5, §6).
 * Réservé aux admins (brief §7 : pas d'inscription publique). Étend le
 * socle d'authentification existant (User + cookie de session signé) sans
 * le réécrire : un compte PENDING n'a simplement pas de passwordHash tant
 * que son lien d'activation n'a pas été utilisé.
 */
export async function usersRoutes(app: FastifyInstance) {
  app.get("/api/users", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
    return users.map(sanitizeUser);
  });

  app.post("/api/users", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const body = createUserSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0]?.message ?? "Requête invalide." });
    }

    const existing = await prisma.user.findUnique({ where: { email: body.data.email } });
    if (existing) {
      return reply.code(409).send({ error: "Un compte existe déjà avec cette adresse e-mail." });
    }

    const name = `${body.data.firstName} ${body.data.lastName}`.trim();
    const invite = generateInviteToken();

    const user = await prisma.user.create({
      data: {
        email: body.data.email,
        name,
        role: body.data.role,
        status: "PENDING",
        invites: { create: { tokenHash: invite.hash, expiresAt: invite.expiresAt } }
      }
    });

    // Le jeton brut n'est renvoyé qu'ici, une seule fois — aucun fournisseur
    // d'e-mail n'étant branché (retours Phase C.5, §3), l'admin le copie
    // manuellement pour le transmettre. Le frontend construit l'URL
    // complète (origine + /activate/:token) : pas de config d'URL de base
    // serveur nécessaire, ce qui reste valable quel que soit l'hébergement
    // (Codespaces compris).
    return reply.code(201).send({ user: sanitizeUser(user), activationToken: invite.raw });
  });

  app.post("/api/users/:id/disable", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const { id } = request.params as { id: string };
    if (id === admin.id) {
      return reply.code(400).send({ error: "Vous ne pouvez pas désactiver votre propre compte." });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.code(404).send({ error: "Utilisateur introuvable." });

    const updated = await prisma.user.update({ where: { id }, data: { status: "DISABLED" } });
    return sanitizeUser(updated);
  });

  app.post("/api/users/:id/reactivate", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const { id } = request.params as { id: string };
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.code(404).send({ error: "Utilisateur introuvable." });

    if (!user.passwordHash) {
      return reply.code(400).send({
        error: "Ce compte n'a jamais été activé (aucun mot de passe défini) — renvoyer une invitation plutôt que réactiver."
      });
    }

    const updated = await prisma.user.update({ where: { id }, data: { status: "ACTIVE" } });
    return sanitizeUser(updated);
  });

  app.post("/api/users/:id/resend-invite", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const { id } = request.params as { id: string };
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.code(404).send({ error: "Utilisateur introuvable." });
    if (user.status !== "PENDING") {
      return reply.code(400).send({ error: "Ce compte a déjà été activé." });
    }

    const invite = generateInviteToken();
    await prisma.$transaction([
      // Les anciens jetons non utilisés deviennent invalides — un seul lien
      // actif à la fois (à usage unique, cf. §3).
      prisma.inviteToken.updateMany({ where: { userId: id, usedAt: null }, data: { expiresAt: new Date() } }),
      prisma.inviteToken.create({ data: { userId: id, tokenHash: invite.hash, expiresAt: invite.expiresAt } })
    ]);

    return { activationToken: invite.raw };
  });
}
