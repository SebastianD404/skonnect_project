import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SKEAP_APPLICATION_DOCX_BASE_SELECT } from "@/lib/docx/skeap-application-template";

export async function getSkeapApplicationDocxSelect() {
  const [columns] = await prisma.$queryRaw<
    Array<{ hasRegisteredVoter: boolean; hasFamilyIncome: boolean; hasSignature: boolean }>
  >`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'skeap_applications'
          AND column_name = 'registeredVoter'
      ) AS "hasRegisteredVoter",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'skeap_applications'
          AND column_name = 'totalFamilyMonthlyIncome'
      ) AS "hasFamilyIncome",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'skeap_applications'
          AND column_name = 'signatureUrl'
      ) AS "hasSignature"
  `;

  return {
    ...SKEAP_APPLICATION_DOCX_BASE_SELECT,
    ...(columns?.hasRegisteredVoter ? { registeredVoter: true } : {}),
    ...(columns?.hasFamilyIncome ? { totalFamilyMonthlyIncome: true } : {}),
    ...(columns?.hasSignature ? { signatureUrl: true } : {}),
  } satisfies Prisma.SkeapApplicationSelect;
}
