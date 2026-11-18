import {
  AccountingPayoutStatus,
  Prisma,
  SubmissionStatus,
} from "@prisma/client";

export type GraduationHoldClient = Pick<
  Prisma.TransactionClient,
  "accountingPayout" | "submission"
>;

export async function getGranteeGraduationHolds(
  client: GraduationHoldClient,
  granteeId: string,
) {
  const [pendingPayout, pendingComplianceCount] = await Promise.all([
    client.accountingPayout.findFirst({
      where: {
        granteeId,
        status: {
          in: [
            AccountingPayoutStatus.PENDING,
            AccountingPayoutStatus.DISBURSED_UNCONFIRMED,
          ],
        },
      },
      select: { id: true },
    }),
    client.submission.count({
      where: {
        granteeId,
        status: {
          in: [
            SubmissionStatus.PENDING,
            SubmissionStatus.PRE_QUALIFIED,
            SubmissionStatus.AWAITING_PHYSICAL_CTC,
            SubmissionStatus.RETURNED_FOR_EDIT,
          ],
        },
      },
    }),
  ]);

  return {
    pendingPayoutHold: pendingPayout !== null,
    pendingComplianceCount,
  };
}
