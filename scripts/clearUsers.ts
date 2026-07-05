import * as dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

// Load environment variables
dotenv.config({ path: [".env.local", ".env"] });

const KEEP_USERS = [
  "f81ac2b6-f157-4dd6-81c2-ab147e5cf6bf", // aldrinacosta@gmail.com (SK_OFFICIAL)
  "b1470142-9ba5-4035-8430-454f62bae8f2", // admin@gmail.com (SUPER_ADMIN)
];

async function clearUsers() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    console.error("DATABASE_URL or DIRECT_URL not set in environment");
    process.exit(1);
  }

  const prismaPool = new Pool({ connectionString });
  const prismaAdapter = new PrismaPg(prismaPool);

  const prisma = new PrismaClient({
    adapter: prismaAdapter,
  });

  try {
    console.log("Starting user cleanup...");

    // Delete all users except the ones in KEEP_USERS
    const result = await prisma.user.deleteMany({
      where: {
        id: {
          notIn: KEEP_USERS,
        },
      },
    });

    console.log(`✓ Deleted ${result.count} users from the database.`);
    console.log("\nKept users:");
    console.log("  - f81ac2b6-f157-4dd6-81c2-ab147e5cf6bf (aldrinacosta@gmail.com, SK_OFFICIAL)");
    console.log("  - b1470142-9ba5-4035-8430-454f62bae8f2 (admin@gmail.com, SUPER_ADMIN)");

    const remainingUsers = await prisma.user.findMany({
      select: { id: true, email: true, role: true },
    });
    console.log("\n✓ Remaining users in database:");
    remainingUsers.forEach((user) => {
      console.log(`  - ${user.id} (${user.email}, ${user.role})`);
    });
  } catch (error) {
    console.error("Error clearing users:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await prismaPool.end();
  }
}

clearUsers();
