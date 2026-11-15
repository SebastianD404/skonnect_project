import { Prisma, Role, SubmissionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { createGmailTransporter, sendBroadcastEmail } from "@/lib/broadcast-email";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAcademicYearDateRange } from "@/lib/semester";
import { getSkeapCapacityCount, getSkeapMaxSlots, lockSkeapCapacity } from "@/lib/skeap-capacity";
import {
  getSkeapWaitlistCycle,
  getSkeapWaitlistCycleSettingKey,
  getSkeapWaitlistCycleState,
} from "@/lib/skeap-waitlist-cycle";

const NOTIFICATION_TITLE = "SKEAP Waitlist Update — Slots Full & Closed";

async function authorizeAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const appUser = await ensureProfile(user);
  if (!appUser || (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user: appUser };
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function POST() {
  try {
    const auth = await authorizeAdmin();
    if ("error" in auth) return auth.error;

    const cycle = getSkeapWaitlistCycle();
    const range = getAcademicYearDateRange(cycle);
    if (!range) throw new Error("Unable to determine the active SKEAP cycle.");

    let result: {
      alreadyClosed: boolean;
      cycle: string;
      notifiedCount: number;
      recipients: Array<{ userId: string; email: string; applicantName: string; position: number }>;
    };

    try {
      result = await prisma.$transaction(async (tx) => {
        await lockSkeapCapacity(tx);
        const cycleState = await getSkeapWaitlistCycleState(cycle, tx);
        if (cycleState.isClosed) {
          return {
            alreadyClosed: true,
            cycle,
            notifiedCount: cycleState.totalWaitlisted,
            recipients: [],
          };
        }

        const [activeCount, maxSlots] = await Promise.all([
          getSkeapCapacityCount(tx),
          getSkeapMaxSlots(tx),
        ]);
        if (activeCount < maxSlots) throw new Error("SLOTS_NOT_FULL");

        const waitlisted = await tx.skeapApplication.findMany({
          where: {
            status: SubmissionStatus.WAITLISTED,
            submittedAt: { gte: range.start, lt: range.end },
          },
          orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            userId: true,
            applicantName: true,
            user: { select: { fullName: true, email: true } },
          },
        });
        if (waitlisted.length === 0) throw new Error("WAITLIST_EMPTY");

        const recipients: Array<{ userId: string; email: string; applicantName: string; position: number }> = [];
        for (const [index, application] of waitlisted.entries()) {
          const position = index + 1;
          const message = `Thank you for applying. The slots are already full and closed. Your final position in the waitlist queue was #${position}.`;

          await tx.skeapApplication.update({
            where: { id: application.id },
            data: {
              waitlistPosition: position,
              waitlistFinalPosition: position,
            },
          });
          const granteeMessage = await tx.granteeMessage.create({
            data: {
              userId: application.userId,
              senderId: auth.user.id,
              subject: NOTIFICATION_TITLE,
              body: message,
            },
            select: { id: true },
          });
          await tx.notification.create({
            data: {
              userId: application.userId,
              sourceKey: `message:${granteeMessage.id}`,
              message: `${NOTIFICATION_TITLE}\n\n${message}`,
            },
          });

          recipients.push({
            userId: application.userId,
            email: application.user.email,
            applicantName: application.applicantName || application.user.fullName || "Applicant",
            position,
          });
        }

        await tx.systemSetting.create({
          data: {
            key: getSkeapWaitlistCycleSettingKey(cycle),
            value: waitlisted.length,
          },
        });
        await writeAuditLog(tx, {
          action: "SKEAP_WAITLIST_CYCLE_CLOSED",
          actorId: auth.user.id,
          targetTable: "skeap_applications",
          targetId: cycle,
          beforeData: { isClosed: false },
          afterData: { isClosed: true, totalWaitlisted: waitlisted.length },
          metadata: { cycle, totalWaitlisted: waitlisted.length },
        });

        return {
          alreadyClosed: false,
          cycle,
          notifiedCount: waitlisted.length,
          recipients,
        };
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const state = await getSkeapWaitlistCycleState(cycle);
      if (!state.isClosed) throw error;
      result = {
        alreadyClosed: true,
        cycle,
        notifiedCount: state.totalWaitlisted,
        recipients: [],
      };
    }

    if (result.alreadyClosed) {
      return NextResponse.json({
        success: true,
        alreadyClosed: true,
        cycle: result.cycle,
        notifiedCount: result.notifiedCount,
        emailFailures: 0,
      });
    }

    let emailFailures = 0;
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      try {
        const transporter = createGmailTransporter();
        const emailResults = await Promise.allSettled(
          result.recipients.map((recipient) =>
            sendBroadcastEmail(
              transporter,
              recipient.userId,
              recipient.email,
              NOTIFICATION_TITLE,
              `Dear ${recipient.applicantName},\n\nThank you for applying. The slots are already full and closed. Your final position in the waitlist queue was #${recipient.position}.`,
            ),
          ),
        );
        emailFailures = emailResults.filter((emailResult) => emailResult.status === "rejected").length;
      } catch (error) {
        emailFailures = result.recipients.length;
        console.error("SKEAP waitlist closure email dispatch could not be initialized.", {
          cycle: result.cycle,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      }
      if (emailFailures > 0) {
        console.error("Some SKEAP waitlist closure emails could not be sent.", {
          cycle: result.cycle,
          emailFailures,
        });
      }
    }

    return NextResponse.json({
      success: true,
      alreadyClosed: false,
      cycle: result.cycle,
      notifiedCount: result.notifiedCount,
      emailFailures,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to close the SKEAP waitlist.";
    if (message === "SLOTS_NOT_FULL") {
      return NextResponse.json({ error: "Close-and-notify is available only after all SKEAP slots are filled." }, { status: 409 });
    }
    if (message === "WAITLIST_EMPTY") {
      return NextResponse.json({ error: "There are no waitlisted applicants to notify." }, { status: 409 });
    }
    console.error("Failed to close SKEAP waitlist:", error);
    return NextResponse.json({ error: "Unable to close the SKEAP waitlist. Please try again." }, { status: 500 });
  }
}
