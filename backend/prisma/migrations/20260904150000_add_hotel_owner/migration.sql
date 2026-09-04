-- Phase H8 — retour réel 2026-09-04 : les hôtels doivent être "propres à
-- chaque compte NAVI, comme pour les portefeuilles" (Portfolio.ownerId).
-- Nullable : les hôtels créés avant ce champ restent honnêtement
-- orphelins (visibles uniquement par un admin — cf. hotelOwnerFilter())
-- plutôt que rattachés à un propriétaire deviné au hasard dans cette
-- migration.

ALTER TABLE "Hotel" ADD COLUMN "ownerId" TEXT;

ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
