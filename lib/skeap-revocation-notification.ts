import { prisma } from "@/lib/prisma";
import { sendSkeapRevocationEmail } from "@/lib/skeap-revocation-email";

const STALE_NOTIFICATION_LEASE_MS = 5 * 60 * 1000;

type RevocationNotificationRecipient = {
  email: string;
  fullName: string;
};

export type RevocationNotificationResult = {
  status: "SENT" | "FAILED" | "SENDING" | "PENDING" | "NOT_REQUIRED";
  errorCode?: "EMAIL_CONFIGURATION_MISSING" | "EMAIL_DELIVERY_FAILED";
};

function getEmailFailureCode(error: unknown): RevocationNotificationResult["errorCode"] {
  if (
    error instanceof Error &&
    error.message.includes("GMAIL_USER and GMAIL_APP_PASSWORD must be configured")
  ) {
    return "EMAIL_CONFIGURATION_MISSING";
  }
  return "EMAIL_DELIVERY_FAILED";
}

export async function dispatchSkeapRevocationNotification({
  granteeId,
  recipient,
  reason,
  additionalNotes,
}: {
  granteeId: string;
  recipient: RevocationNotificationRecipient;
  reason: string;
  additionalNotes: string | null;
}): Promise<RevocationNotificationResult> {
  const staleLeaseBefore = new Date(Date.now() - STALE_NOTIFICATION_LEASE_MS);
  const claim = await prisma.grantee.updateMany({
    where: {
      id: granteeId,
      status: "REVOKED",
      OR: [
        { revocationNotificationStatus: { in: ["PENDING", "FAILED"] } },
        {
          revocationNotificationStatus: "SENDING",
          updatedAt: { lt: staleLeaseBefore },
        },
      ],
    },
    data: {
      revocationNotificationStatus: "SENDING",
      revocationNotificationAttempts: { increment: 1 },
      revocationNotificationError: null,
    },
  });

  if (claim.count === 0) {
    const current = await prisma.grantee.findUnique({
      where: { id: granteeId },
      select: { revocationNotificationStatus: true },
    });
    if (!current) throw new Error("GRANTEE_NOT_FOUND");
    return { status: current.revocationNotificationStatus };
  }

  try {
    await sendSkeapRevocationEmail({
      granteeId,
      recipient,
      reason,
      additionalNotes,
    });
  } catch (error) {
    const errorCode = getEmailFailureCode(error);
    console.error("SKEAP revocation notification delivery failed", {
      granteeId,
      errorCode,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    const failed = await prisma.grantee.updateMany({
      where: {
        id: granteeId,
        status: "REVOKED",
        revocationNotificationStatus: "SENDING",
      },
      data: {
        revocationNotificationStatus: "FAILED",
        revocationNotificationError: errorCode,
      },
    });
    if (failed.count !== 1) {
      throw new Error("REVOCATION_NOTIFICATION_FAILURE_STATE_NOT_SAVED");
    }
    return { status: "FAILED", errorCode };
  }

  const sent = await prisma.grantee.updateMany({
    where: {
      id: granteeId,
      status: "REVOKED",
      revocationNotificationStatus: "SENDING",
    },
    data: {
      revocationNotificationStatus: "SENT",
      revocationNotificationError: null,
      revocationNotificationSentAt: new Date(),
    },
  });
  if (sent.count !== 1) {
    throw new Error("REVOCATION_NOTIFICATION_SENT_STATE_NOT_SAVED");
  }

  return { status: "SENT" };
}
