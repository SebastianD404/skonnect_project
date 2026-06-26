import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../node_modules/.prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPool?: Pool;
  prismaAdapter?: PrismaPg;
};

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error("Prisma requires DATABASE_URL or DIRECT_URL to be set.");
}

process.env.DATABASE_URL = connectionString;

const prismaPool = globalForPrisma.prismaPool ?? new Pool({ connectionString });
const prismaAdapter = globalForPrisma.prismaAdapter ?? new PrismaPg(prismaPool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: prismaAdapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaPool = prismaPool;
  globalForPrisma.prismaAdapter = prismaAdapter;
}

const PROFILING_REGISTRATION_TABLE = "kk_profiling_registrations";
const PROFILING_REGISTRATION_UNAVAILABLE_MESSAGE =
  "Profiling registrations are currently unavailable because the database table is not present.";

async function hasTable(tableName: string) {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      "SELECT to_regclass($1) IS NOT NULL AS exists",
      `public.${tableName}`
    );
    return rows[0]?.exists ?? false;
  } catch {
    return false;
  }
}

function isMissingTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /does not exist|relation .* does not exist|table .* does not exist|TableDoesNotExist/i.test(message);
}

export async function getProfilingRegistrationCount() {
  if (!(await hasTable(PROFILING_REGISTRATION_TABLE))) {
    return 0;
  }

  try {
    return await prisma.profilingRegistration.count();
  } catch (error) {
    if (isMissingTableError(error)) {
      return 0;
    }
    throw error;
  }
}

export async function listProfilingRegistrations(args?: any) {
  if (!(await hasTable(PROFILING_REGISTRATION_TABLE))) {
    return [];
  }

  try {
    return await prisma.profilingRegistration.findMany(args);
  } catch (error) {
    if (isMissingTableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function createProfilingRegistration(args: any) {
  if (!(await hasTable(PROFILING_REGISTRATION_TABLE))) {
    throw new Error(PROFILING_REGISTRATION_UNAVAILABLE_MESSAGE);
  }

  try {
    return await prisma.profilingRegistration.create(args);
  } catch (error) {
    if (isMissingTableError(error)) {
      throw new Error(PROFILING_REGISTRATION_UNAVAILABLE_MESSAGE);
    }
    throw error;
  }
}
