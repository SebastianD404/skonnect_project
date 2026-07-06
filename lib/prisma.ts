import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
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

export async function hasProfilingRegistrationColumn(columnName: string) {
  if (!(await hasTable(PROFILING_REGISTRATION_TABLE))) {
    return false;
  }

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists`,
      PROFILING_REGISTRATION_TABLE,
      columnName
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

function isMissingColumnError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /column .* does not exist|Column .* does not exist|Undefined column/i.test(message);
}

function sanitizeWhereForProfilingRegistrations(where: Record<string, unknown> | undefined) {
  if (!where || typeof where !== "object") {
    return undefined;
  }

  return Object.keys(where).length > 0 ? { ...where } : undefined;
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

export async function getProfilingRegistrationCountByStatus(status?: string | null) {
  if (!(await hasTable(PROFILING_REGISTRATION_TABLE))) {
    return 0;
  }

  const normalizedStatus = status?.trim();
  if (!normalizedStatus) {
    return getProfilingRegistrationCount();
  }

  if (!(await hasProfilingRegistrationColumn("reviewStatus"))) {
    return 0;
  }

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM "kk_profiling_registrations" WHERE "reviewStatus" = $1`,
      normalizedStatus
    );
    return Number(rows[0]?.count ?? 0);
  } catch (error) {
    if (isMissingTableError(error) || isMissingColumnError(error)) {
      return 0;
    }
    throw error;
  }
}

export async function getProfilingRegistrationCountByStatusSince(status: string | null, since: Date) {
  if (!(await hasTable(PROFILING_REGISTRATION_TABLE))) {
    return 0;
  }

  const normalizedStatus = status?.trim();
  if (!normalizedStatus) {
    return 0;
  }

  if (!(await hasProfilingRegistrationColumn("reviewStatus"))) {
    return 0;
  }

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM "kk_profiling_registrations" WHERE "reviewStatus" = $1 AND "submittedAt" >= $2`,
      normalizedStatus,
      since.toISOString()
    );
    return Number(rows[0]?.count ?? 0);
  } catch (error) {
    if (isMissingTableError(error) || isMissingColumnError(error)) {
      return 0;
    }
    throw error;
  }
}

export async function getWeeklyProfilingRegistrationCount() {
  if (!(await hasTable(PROFILING_REGISTRATION_TABLE))) {
    return 0;
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    return await prisma.profilingRegistration.count({
      where: {
        submittedAt: {
          gte: sevenDaysAgo,
        },
      },
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return 0;
    }
    throw error;
  }
}

export async function getMonthlyProfilingRegistrationCount() {
  if (!(await hasTable(PROFILING_REGISTRATION_TABLE))) {
    return 0;
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    return await prisma.profilingRegistration.count({
      where: {
        submittedAt: {
          gte: startOfMonth,
        },
      },
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return 0;
    }
    throw error;
  }
}

export async function getWeeklyProfilingRegistrationCountByClassification(classification: string) {
  if (!(await hasTable(PROFILING_REGISTRATION_TABLE))) {
    return 0;
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    return await prisma.profilingRegistration.count({
      where: {
        youthClassification: classification,
        submittedAt: {
          gte: sevenDaysAgo,
        },
      },
    });
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

  const safeArgs = args ? { ...args } : undefined;
  const where = safeArgs?.where as Record<string, unknown> | undefined;
  if (where && typeof where === "object" && "reviewStatus" in where) {
    safeArgs.where = sanitizeWhereForProfilingRegistrations(where);
  }

  try {
    return await prisma.profilingRegistration.findMany(safeArgs);
  } catch (error) {
    if (isMissingTableError(error) || isMissingColumnError(error)) {
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
