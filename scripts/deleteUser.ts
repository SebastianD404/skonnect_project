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

const userId = "6314174d-42c7-4493-9c72-5874d32326ad";
const email = "will.smith@example.com";

async function deleteUser() {
  const prismaPool = new Pool({ connectionString });
  const prismaAdapter = new PrismaPg(prismaPool);
  const prisma = new PrismaClient({ adapter: prismaAdapter });

  try {
    console.log(`Starting deletion of user: ${email} (ID: ${userId})...`);

    // Delete the user
    const deleted = await prisma.user.deleteMany({
      where: {
        id: userId,
      },
    });

    console.log(`✓ Deleted ${deleted.count} user(s)`);

    // Verify deletion
    const remaining = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (remaining) {
      console.log(`⚠ User still exists: ${remaining.email}`);
    } else {
      console.log(`✓ User successfully deleted from database`);
    }
  } catch (error) {
    console.error("❌ Error deleting user:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await prismaPool.end();
  }
}

deleteUser();
