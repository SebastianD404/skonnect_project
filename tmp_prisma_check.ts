import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL || "postgresql://user:pass@localhost:5432/db",
  }),
});

const test = prisma.announcement;
console.log(test);
