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

const updates = [
  {
    userId: "f81ac2b6-f157-4dd6-81c2-ab147e5cf6bf",
    email: "aldrinacosta@gmail.com",
    newAuthId: "ca23cd92-51ee-4d48-916b-b912f67abce9",
  },
  {
    userId: "b1470142-9ba5-4035-8430-454f62bae8f2",
    email: "admin@gmail.com",
    newAuthId: "5d68fa01-7c6d-4a07-85a7-b660d4f46ead",
  },
];

async function updateAuthIds() {
  const prismaPool = new Pool({ connectionString });
  const prismaAdapter = new PrismaPg(prismaPool);
  const prisma = new PrismaClient({ adapter: prismaAdapter });

  try {
    console.log("Updating authId values in users table...\n");

    for (const update of updates) {
      const user = await prisma.user.update({
        where: { id: update.userId },
        data: { authId: update.newAuthId },
        select: {
          id: true,
          email: true,
          authId: true,
          role: true,
        },
      });

      console.log(`✓ Updated ${update.email}`);
      console.log(`  Old authId: (unknown)`);
      console.log(`  New authId: ${user.authId}`);
    }

    console.log("\n✓ All authId values have been synchronized");
  } catch (error) {
    console.error("❌ Error updating authIds:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await prismaPool.end();
  }
}

updateAuthIds();
