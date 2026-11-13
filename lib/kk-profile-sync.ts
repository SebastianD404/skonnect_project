import { Prisma, Sex } from "@prisma/client";
import { getOfficialKkSitio } from "@/lib/address";
import { parseSex } from "@/lib/sex";

export async function syncKkProfileFromLatestRegistration(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const [account, registration] = await Promise.all([
    tx.user.findUnique({
      where: { id: userId },
      select: { kkProfileId: true },
    }),
    tx.profilingRegistration.findFirst({
      where: { userId },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      select: { address: true, reviewStatus: true, sex: true },
    }),
  ]);
  if (!account?.kkProfileId || !registration) return;

  const sitio = getOfficialKkSitio(registration.address);
  await tx.kKProfile.update({
    where: { id: account.kkProfileId },
    data: {
      sex: parseSex(registration.sex) ?? Sex.NOT_SPECIFIED,
      isVerified: registration.reviewStatus.trim().toLowerCase() === "approved",
      ...(sitio ? { purok: sitio } : {}),
    },
  });
}
