-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- AlterTable: replace boolean `active` with a 3-state `status`, preserving
-- existing data (true -> ACTIVE, false -> DISABLED). passwordHash becomes
-- nullable: a PENDING user (created by an admin, invited) has no password
-- until they activate their account.
ALTER TABLE "User" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'PENDING';
UPDATE "User" SET "status" = CASE WHEN "active" THEN 'ACTIVE'::"UserStatus" ELSE 'DISABLED'::"UserStatus" END;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" DROP COLUMN "active";

-- CreateTable
CREATE TABLE "InviteToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InviteToken_tokenHash_key" ON "InviteToken"("tokenHash");

-- CreateIndex
CREATE INDEX "InviteToken_userId_idx" ON "InviteToken"("userId");

-- AddForeignKey
ALTER TABLE "InviteToken" ADD CONSTRAINT "InviteToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Hotel simplifié — retours Phase C.5 (2026-09-01) : ville et
-- nombre d'étoiles retirés (aucun intérêt fonctionnel pour NAVI, jamais
-- récupérés depuis Expérience) ; ajout d'un identifiant Expérience stable
-- pour la future vérification Playwright (non implémentée dans cette passe).
ALTER TABLE "Hotel" DROP COLUMN "city",
DROP COLUMN "starRating",
DROP COLUMN "roomCount",
ADD COLUMN     "experienceHotelId" TEXT;
