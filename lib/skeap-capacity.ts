import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const SKEAP_MAX_SLOTS_KEY = "SKEAP_MAX_SLOTS";
export const DEFAULT_SKEAP_MAX_SLOTS = 55;
export const ACTIVE_SKEAP_APPLICATION_WHERE = {
  status: "APPROVED",
  OR: [
    { user: { grantee: { is: null } } },
    { user: { grantee: { is: { status: { in: ["ACTIVE", "PROBATIONARY"] } } } } },
  ],
} satisfies Prisma.SkeapApplicationWhereInput;

export async function getSkeapMaxSlots(client: typeof prisma = prisma) {
  const systemSetting = (client as typeof prisma & {
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

  return setting?.value ?? DEFAULT_SKEAP_MAX_SLOTS;
}

export async function setSkeapMaxSlots(value: number) {
  const systemSetting = (prisma as typeof prisma & {
    systemSetting?: typeof prisma.systemSetting;
  }).systemSetting;
  if (systemSetting) {
    return systemSetting.upsert({
      where: { key: SKEAP_MAX_SLOTS_KEY },
      create: { key: SKEAP_MAX_SLOTS_KEY, value },
      update: { value },
    });
  }

  const rows = await prisma.$queryRawUnsafe<Array<{ key: string; value: number; updatedAt: Date }>>(
    `INSERT INTO "system_settings" ("id", "key", "value", "updatedAt")
     VALUES ('cm_skeap_max_slots', '${SKEAP_MAX_SLOTS_KEY}', ${value}, CURRENT_TIMESTAMP)
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP
     RETURNING "key", "value", "updatedAt"`
  );
  return rows[0];
}