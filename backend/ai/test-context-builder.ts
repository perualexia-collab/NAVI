import "dotenv/config";
import { prisma } from "../src/db/prisma.js";
import {
  getHotelHealth,
  getScanHistory,
  getPortfolioSignals,
  getTopOpportunities,
  getHotelsWithoutRecentScan
} from "./context-builder/index.js";

/**
 * Sanity check du Context Builder contre de vraies données — ne touche à
 * AUCUN LLM (contrairement à ai:test-connection). Prend le premier hôtel
 * et le premier portefeuille existants plutôt que des identifiants
 * inventés : rien à configurer, tourne tel quel dans n'importe quel
 * Codespace ayant déjà au moins un hôtel scanné.
 *
 * Phase H8 — les hôtels sont désormais propres à chaque compte NAVI :
 * ce script "voit tout" en simulant un admin (premier compte ADMIN
 * trouvé), comme avant ce changement — ce n'est qu'un sanity check
 * technique, pas une simulation d'un utilisateur réel précis.
 */
async function main() {
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!adminUser) {
    console.log("Aucun compte ADMIN en base — rien à tester (le seed dev en crée un normalement).");
    return;
  }
  const requestingUser = { id: adminUser.id, role: adminUser.role };

  const hotel = await prisma.hotel.findFirst({ orderBy: { name: "asc" } });
  if (!hotel) {
    console.log("Aucun hôtel en base — rien à tester (crée/scanne un hôtel d'abord).");
    return;
  }

  console.log(`=== getHotelHealth("${hotel.name}") ===`);
  console.log(JSON.stringify(await getHotelHealth(hotel.id, requestingUser), null, 2));

  console.log(`\n=== getScanHistory("${hotel.name}") ===`);
  console.log(JSON.stringify(await getScanHistory(hotel.id, requestingUser), null, 2));

  console.log("\n=== getTopOpportunities(5) ===");
  console.log(JSON.stringify(await getTopOpportunities(requestingUser, 5), null, 2));

  console.log("\n=== getHotelsWithoutRecentScan(30) ===");
  console.log(JSON.stringify(await getHotelsWithoutRecentScan(requestingUser, 30), null, 2));

  const portfolio = await prisma.portfolio.findFirst({ orderBy: { createdAt: "asc" } });
  if (portfolio) {
    console.log(`\n=== getPortfolioSignals("${portfolio.name}") ===`);
    console.log(JSON.stringify(await getPortfolioSignals(portfolio.ownerId, portfolio.id), null, 2));
  } else {
    console.log("\nAucun portefeuille en base — getPortfolioSignals() non testé.");
  }
}

main()
  .catch((error) => {
    console.error("❌ Échec du test Context Builder :", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
