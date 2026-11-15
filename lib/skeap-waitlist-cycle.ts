import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAcademicYearDateRange, getCurrentAcademicYear } from "@/lib/semester";

export const SKEAP_WAITLIST_CLOSED_SETTING_PREFIX = "SKEAP_WAITLIST_CLOSED:";

type WaitlistCycleClient = Pick<Prisma.TransactionClient, "systemSetting">;

export function getSkeapWaitlistCycle(programIdOrCycle?: string) {
  const requestedCycle = programIdOrCycle?.trim();
  return requestedCycle && getAcademicYearDateRange(requestedCycle)
    ? requestedCycle
    : getCurrentAcademicYear();
}

export function getSkeapWaitlistCycleSettingKey(programIdOrCycle?: string) {
  return `${SKEAP_WAITLIST_CLOSED_SETTING_PREFIX}${getSkeapWaitlistCycle(programIdOrCycle)}`;
}

export async function getSkeapWaitlistCycleState(
  programIdOrCycle?: string,
  client: WaitlistCycleClient = prisma,
) {
  const cycle = getSkeapWaitlistCycle(programIdOrCycle);
  const setting = await client.systemSetting.findUnique({
    where: { key: getSkeapWaitlistCycleSettingKey(cycle) },
    select: { value: true },
  });
  const totalWaitlisted = setting?.value ?? 0;
  return {
    cycle,
    isClosed: totalWaitlisted > 0,
    totalWaitlisted,
  };
}
