import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ACTIVE_SKEAP_EDUCATION_LEVELS,
  SKEAP_EDUCATION_LEVEL_OPTIONS,
  type SkeapEducationLevelCode,
} from "@/lib/skeap-education";

export const SKEAP_EDUCATION_LEVELS_SETTING_KEY = "SKEAP_ACTIVE_EDUCATION_LEVELS";
export const SKEAP_MAX_ELIGIBLE_AGE_SETTING_KEY = "SKEAP_MAX_ELIGIBLE_AGE";
export const DEFAULT_SKEAP_MAX_ELIGIBLE_AGE = 30;
type SkeapProgramConfigClient = Pick<Prisma.TransactionClient, "systemSetting">;

const EDUCATION_LEVEL_BITS: Record<SkeapEducationLevelCode, number> = {
  JUNIOR_HIGH: 1,
  SENIOR_HIGH: 2,
  COLLEGE: 4,
  TECH_VOC: 8,
};

function decodeEducationLevels(value: number): SkeapEducationLevelCode[] {
  const allowedBits = Object.values(EDUCATION_LEVEL_BITS).reduce((bits, value) => bits | value, 0);
  if (!Number.isInteger(value) || value <= 0 || (value & ~allowedBits) !== 0) {
    throw new Error("The current SKEAP education-level configuration is invalid.");
  }
  return SKEAP_EDUCATION_LEVEL_OPTIONS
    .filter((option) => (value & EDUCATION_LEVEL_BITS[option.value]) !== 0)
    .map((option) => option.value);
}

export async function getActiveSkeapEducationLevels(
  client: SkeapProgramConfigClient = prisma,
): Promise<SkeapEducationLevelCode[]> {
  const setting = await client.systemSetting.findUnique({
    where: { key: SKEAP_EDUCATION_LEVELS_SETTING_KEY },
    select: { value: true },
  });
  if (!setting) return [...ACTIVE_SKEAP_EDUCATION_LEVELS];
  return decodeEducationLevels(setting.value);
}

export async function setActiveSkeapEducationLevels(
  levels: readonly SkeapEducationLevelCode[],
  client: SkeapProgramConfigClient = prisma,
) {
  if (!levels.length || levels.some((level) => !EDUCATION_LEVEL_BITS[level])) {
    throw new Error("At least one valid SKEAP education category must be enabled.");
  }
  const value = levels.reduce((bits, level) => bits | EDUCATION_LEVEL_BITS[level], 0);

  return client.systemSetting.upsert({
    where: { key: SKEAP_EDUCATION_LEVELS_SETTING_KEY },
    create: { key: SKEAP_EDUCATION_LEVELS_SETTING_KEY, value },
    update: { value },
  });
}

export async function getSkeapMaxEligibleAge(
  client: SkeapProgramConfigClient = prisma,
): Promise<number> {
  const setting = await client.systemSetting.findUnique({
    where: { key: SKEAP_MAX_ELIGIBLE_AGE_SETTING_KEY },
    select: { value: true },
  });
  const maxEligibleAge = setting?.value ?? DEFAULT_SKEAP_MAX_ELIGIBLE_AGE;
  if (!Number.isInteger(maxEligibleAge) || maxEligibleAge < 15 || maxEligibleAge > 30) {
    throw new Error("The current SKEAP maximum eligible age configuration is invalid.");
  }
  return maxEligibleAge;
}

export async function setSkeapMaxEligibleAge(
  maxEligibleAge: number,
  client: SkeapProgramConfigClient = prisma,
) {
  if (!Number.isInteger(maxEligibleAge) || maxEligibleAge < 15 || maxEligibleAge > 30) {
    throw new Error("The SKEAP maximum eligible age must be between 15 and 30.");
  }

  return client.systemSetting.upsert({
    where: { key: SKEAP_MAX_ELIGIBLE_AGE_SETTING_KEY },
    create: { key: SKEAP_MAX_ELIGIBLE_AGE_SETTING_KEY, value: maxEligibleAge },
    update: { value: maxEligibleAge },
  });
}
