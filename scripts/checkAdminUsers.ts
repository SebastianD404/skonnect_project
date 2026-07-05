import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

dotenv.config({ path: [".env.local", ".env"] });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ Error: CONNECTION_STRING or DATABASE_URL not set");
  process.exit(1);
}

async function checkAdminUsers() {
  const prismaPool = new Pool({ connectionString });
  const prismaAdapter = new PrismaPg(prismaPool);
  const prisma = new PrismaClient({ adapter: prismaAdapter });

  try {
    console.log("Checking for admin users in database...\n");

    const adminIds = [
      "f81ac2b6-f157-4dd6-81c2-ab147e5cf6bf",
      "b1470142-9ba5-4035-8430-454f62bae8f2",
    ];

    for (const id of adminIds) {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
        },
      });

      if (user) {
        console.log(`✓ Found: ${user.email} (${user.role})`);
      } else {
        console.log(`✗ Not found: ${id}`);
      }
    }

    console.log("\nTotal users in database:");
    const totalUsers = await prisma.user.count();
    console.log(`  Count: ${totalUsers}`);

    if (totalUsers > 0) {
      const allUsers = await prisma.user.findMany({
        select: { id: true, email: true, role: true },
      });
      console.log("\nAll remaining users:");
      for (const u of allUsers) {
        console.log(`  - ${u.email} (${u.role})`);
      }
    }
  } catch (error) {
    console.error("❌ Error checking users:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await prismaPool.end();
  }
}

checkAdminUsers();
