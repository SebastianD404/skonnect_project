import type { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";

export async function downgradeInactiveGranteeRole(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  await tx.user.updateMany({
    where: { id: userId, role: Role.GRANTEE },
    data: { role: Role.YOUTH },
  });
}
