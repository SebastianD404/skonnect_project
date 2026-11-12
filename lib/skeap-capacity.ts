import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { DEFAULT_SKEAP_MAX_SLOTS, SKEAP_MAX_SLOTS_KEY } from "@/lib/skeap-capacity-constants";

export { DEFAULT_SKEAP_MAX_SLOTS, SKEAP_MAX_SLOTS_KEY } from "@/lib/skeap-capacity-constants";

type SkeapCapacityReadClient = Pick<Prisma.TransactionClient, "grantee" | "skeapApplication">;

export async function lockSkeapCapacity(tx: Prisma.TransactionClient) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const [result] = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(2026, 55) AS locked
    `;
    if (result?.locked) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("SKEAP_CAPACITY_LOCK_TIMEOUT");
}

export async function getSkeapCapacityCount(
  client: SkeapCapacityReadClient = prisma,
  excludeUserId?: string
) {
  const userFilter = excludeUserId ? { userId: { not: excludeUserId } } : {};
  const [activeGrantees, approvedApplicants] = await Promise.all([
    client.grantee.findMany({
      where: {
        status: { in: ["ACTIVE", "PROBATIONARY"] },
        ...userFilter,
      },
      select: { userId: true },
    }),
    client.skeapApplication.findMany({
      where: {
        status: "APPROVED",
        OR: [
          { user: { grantee: { is: null } } },
          { user: { grantee: { is: { status: { in: ["ACTIVE", "PROBATIONARY"] } } } } },
        ],
        ...userFilter,
      },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);
  return new Set([
    ...activeGrantees.map(({ userId }) => userId),
    ...approvedApplicants.map(({ userId }) => userId),
  ]).size;
}

export async function getSkeapMaxSlots(
  client: typeof prisma | Prisma.TransactionClient = prisma
) {
  const systemSetting = (client as {
    systemSetting?: typeof prisma.systemSetting;
  }).systemSetting;
  const setting = systemSetting
    ? await systemSetting.findUnique({
        where: { key: SKEAP_MAX_SLOTS_KEY },
        select: { value: true },
      })
    : (await client.$queryRawUnsafe<Array<{ value: number }>>(
        `SELECT "value" FROM "system_settings" WHERE "key" = '${SKEAP_MAX_SLOTS_KEY}' LIMIT 1`
      ))[0] ?? null;

  return Math.min(Math.max(setting?.value ?? DEFAULT_SKEAP_MAX_SLOTS, 1), DEFAULT_SKEAP_MAX_SLOTS);
}

export async function setSkeapMaxSlots(
  value: number,
  client: typeof prisma | Prisma.TransactionClient = prisma
) {
  if (!Number.isInteger(value) || value < 1 || value > DEFAULT_SKEAP_MAX_SLOTS) {
    throw new Error(`SKEAP slot limit must be between 1 and ${DEFAULT_SKEAP_MAX_SLOTS}.`);
  }

  const systemSetting = (client as {
    systemSetting?: typeof prisma.systemSetting;
  }).systemSetting;
  if (systemSetting) {
    return systemSetting.upsert({
      where: { key: SKEAP_MAX_SLOTS_KEY },
      create: { key: SKEAP_MAX_SLOTS_KEY, value },
      update: { value },
    });
  }

  const rows = await client.$queryRawUnsafe<Array<{ key: string; value: number; updatedAt: Date }>>(
    `INSERT INTO "system_settings" ("id", "key", "value", "updatedAt")
     VALUES ('cm_skeap_max_slots', '${SKEAP_MAX_SLOTS_KEY}', ${value}, CURRENT_TIMESTAMP)
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP
     RETURNING "key", "value", "updatedAt"`
  );
  return rows[0];
}