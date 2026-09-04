import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { kpiDefinitions } from "./seed-data/kpi-definitions.js";
import { signalDefinitions } from "./seed-data/signal-definitions.js";
import { audienceDefinitions } from "./seed-data/audience-definitions.js";
import { pilotHotel } from "./seed-data/pilot-hotel.js";
import { devAdmin } from "./seed-data/dev-admin.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seed NAVI — référentiel métier (KPI, signaux, audiences)");

  for (const kpi of kpiDefinitions) {
    await prisma.kPIDefinition.upsert({
      where: { id: kpi.id },
      create: kpi,
      update: kpi
    });
  }
  console.log(`  ✓ ${kpiDefinitions.length} KPI définis (catalogue "Cartographie KPIs")`);

  for (const signal of signalDefinitions) {
    await prisma.signalDefinition.upsert({
      where: { playbookId: signal.playbookId },
      create: signal,
      update: signal
    });
  }
  console.log(`  ✓ ${signalDefinitions.length} signaux définis (catalogue "Signals & Playbook")`);

  for (const audience of audienceDefinitions) {
    await prisma.audienceDefinition.upsert({
      where: { id: audience.id },
      create: audience,
      update: audience
    });
  }
  console.log(`  ✓ ${audienceDefinitions.length} définitions d'audience`);

  // Phase H8 — retour réel 2026-09-04 : les hôtels sont propres à chaque
  // compte NAVI. Le compte dev admin est créé AVANT l'hôtel pilote (ordre
  // inversé par rapport à avant) pour pouvoir le lui rattacher —
  // sinon l'hôtel pilote serait orphelin (visible par un admin, mais
  // jamais pré-affecté à personne) au tout premier lancement.
  let devAdminUserId: string | undefined;
  if (process.env.SEED_DEV_ADMIN === "true") {
    const passwordHash = await argon2.hash(devAdmin.password);
    const createdDevAdmin = await prisma.user.upsert({
      where: { email: devAdmin.email },
      create: { email: devAdmin.email, passwordHash, name: devAdmin.name, role: "ADMIN", status: "ACTIVE" },
      update: { passwordHash }
    });
    devAdminUserId = createdDevAdmin.id;
    console.log(`  ✓ compte de développement local : ${devAdmin.email}`);
  }

  await prisma.hotel.upsert({
    where: { id: pilotHotel.id },
    create: { ...pilotHotel, ownerId: devAdminUserId },
    update: { ...pilotHotel, ownerId: devAdminUserId }
  });
  console.log(`  ✓ hôtel pilote du vertical slice : ${pilotHotel.name} (statut ${pilotHotel.experienceStatus})`);

  console.log("Seed terminé.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
