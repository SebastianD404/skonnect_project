import { AccountingPayoutStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createGmailTransporter, sendPayoutDisbursementEmail } from "@/lib/broadcast-email";
import { writeAuditLog } from "@/lib/audit/logger";

const GRANT_AMOUNT = 5000;

function getPayoutConfirmationUrl() {
  const vercelUrl = process.env.VERCEL_URL?.trim();
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (vercelUrl ? `https://${vercelUrl}` : null) ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : null);
  if (!configuredUrl) {
    throw new Error(
      "Set NEXT_PUBLIC_APP_URL or VERCEL_URL to create payout confirmation links in production.",
    );
  }

  const appUrl = new URL(configuredUrl);
  if (appUrl.protocol !== "https:" && appUrl.protocol !== "http:") {
    throw new Error("The payout confirmation URL must use HTTP or HTTPS.");
  }
  const loginUrl = new URL("/login", appUrl);
  loginUrl.searchParams.set("next", "/grantee/payouts");
  return loginUrl.toString();
}

export async function dispatchPayout({
  granteeId,
  semester,
  actorId,
}: {
  granteeId: string;
  semester: string;
  actorId: string;
}) {
  const grantee = await prisma.grantee.findUnique({
    where: { id: granteeId },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          kkProfile: { select: { firstName: true, email: true } },
        },
      },
    },
  });
  if (!grantee) throw new Error("Grantee not found.");

  const transition = await prisma.$transaction(async (tx) => {
    const before = await tx.accountingPayout.findUnique({ where: { granteeId } });
    if (before?.status === AccountingPayoutStatus.CONFIRMED) {
      return { payout: before, shouldSendEmail: false, dispatchedNow: false };
    }

    if (before?.status === AccountingPayoutStatus.DISBURSED_UNCONFIRMED) {
      return {
        payout: before,
        shouldSendEmail: before.disbursementEmailSentAt === null,
        dispatchedNow: false,
      };
    }

    const now = new Date();
    const payout = await tx.accountingPayout.upsert({
      where: { granteeId },
      update: {
        amount: GRANT_AMOUNT,
        semester,
        status: AccountingPayoutStatus.DISBURSED_UNCONFIRMED,
        disbursedAt: now,
        claimedAt: null,
      },
      create: {
        granteeId,
        amount: GRANT_AMOUNT,
        semester,
        status: AccountingPayoutStatus.DISBURSED_UNCONFIRMED,
        disbursedAt: now,
      },
    });

    const amount = new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(payout.amount);
    await tx.notification.upsert({
      where: {
        userId_sourceKey: {
          userId: grantee.user.id,
          sourceKey: `payout-disbursed:${payout.id}`,
        },
      },
      update: {
        message: `The ${semester} payout of ${amount} has been disbursed. Please confirm receipt in your payouts dashboard.`,
      },
      create: {
        userId: grantee.user.id,
        sourceKey: `payout-disbursed:${payout.id}`,
        message: `The ${semester} payout of ${amount} has been disbursed. Please confirm receipt in your payouts dashboard.`,
      },
    });
    await writeAuditLog(tx, {
      action: "PAYOUT_DISBURSED",
      actorId,
      targetTable: "accounting_payouts",
      targetId: payout.id,
      beforeData: before,
      afterData: payout,
      metadata: { granteeId, semester },
    });

    return { payout, shouldSendEmail: true, dispatchedNow: true };
  });

  if (!transition.shouldSendEmail) {
    return {
      payout: transition.payout,
      dispatchedNow: transition.dispatchedNow,
      emailStatus: transition.payout.disbursementEmailSentAt ? "sent" as const : "not_attempted" as const,
      emailError: null,
    };
  }

  try {
    const recipientEmail = grantee.user.email.trim() || grantee.user.kkProfile?.email.trim();
    if (!recipientEmail) throw new Error("No registered email address is available for this grantee.");
    const recipientName =
      grantee.user.kkProfile?.firstName.trim() ||
      grantee.user.fullName.trim().split(/\s+/)[0] ||
      "Scholar";
    const transporter = createGmailTransporter();
    await sendPayoutDisbursementEmail(transporter, recipientEmail, {
      recipientName,
      semester: transition.payout.semester ?? semester,
      amount: transition.payout.amount,
      confirmationUrl: getPayoutConfirmationUrl(),
    });
    await prisma.accountingPayout.updateMany({
      where: {
        id: transition.payout.id,
        status: AccountingPayoutStatus.DISBURSED_UNCONFIRMED,
        disbursementEmailSentAt: null,
      },
      data: { disbursementEmailSentAt: new Date() },
    });

    return {
      payout: transition.payout,
      dispatchedNow: transition.dispatchedNow,
      emailStatus: "sent" as const,
      emailError: null,
    };
  } catch (error) {
    const emailError = error instanceof Error ? error.message : "Payout email could not be sent.";
    console.error("Could not send payout disbursement email:", {
      payoutId: transition.payout.id,
      granteeId,
      error,
    });
    return {
      payout: transition.payout,
      dispatchedNow: transition.dispatchedNow,
      emailStatus: "failed" as const,
      emailError,
    };
  }
}
