import { AccountingPayoutStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

function parseTerm(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{4}) (First|Second) Semester$/.exec(value);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) return null;
  return {
    label: value,
    academicYear: `${match[1]}-${match[2]}`,
    semester: `${match[3]} Semester`,
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUser = await ensureProfile(user);
  if (!appUser || (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Provide valid source and destination terms." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Provide valid source and destination terms." }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const sourceTerm = parseTerm(body.fromTerm);
  const destinationTerm = parseTerm(body.toTerm);
  if (!sourceTerm || !destinationTerm || sourceTerm.label === destinationTerm.label) {
    return NextResponse.json({ error: "The selected academic terms are invalid." }, { status: 400 });
  }

  const now = new Date();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const openSchedule = await tx.academicTermSchedule.findUnique({
        where: { semester: destinationTerm.label },
        select: { opensAt: true, closesAt: true },
      });
      if (!openSchedule || openSchedule.opensAt > now || openSchedule.closesAt < now) {
        return { error: "The destination term no longer has an open submission schedule.", status: 409 as const };
      }

      const candidates = await tx.grantee.findMany({
        where: {
          status: { in: ["ACTIVE", "PROBATIONARY"] },
          entryAcademicYear: sourceTerm.academicYear,
          entrySemester: sourceTerm.semester,
        },
        select: {
          id: true,
          entryAcademicYear: true,
          entrySemester: true,
          submissions: {
            where: { semester: sourceTerm.label, status: "APPROVED" },
            select: { id: true },
          },
          payout: {
            select: {
              id: true,
              semester: true,
              status: true,
              disbursedAt: true,
              claimedAt: true,
            },
          },
        },
      });

      let updatedCount = 0;
      let skippedCount = 0;
      for (const grantee of candidates) {
        const payoutDisbursedForSourceTerm =
          grantee.payout?.semester === sourceTerm.label &&
          (grantee.payout.disbursedAt !== null ||
            grantee.payout.claimedAt !== null ||
            grantee.payout.status === AccountingPayoutStatus.DISBURSED_UNCONFIRMED ||
            grantee.payout.status === AccountingPayoutStatus.CONFIRMED);
        if (grantee.submissions.length > 0 || payoutDisbursedForSourceTerm) {
          skippedCount += 1;
          continue;
        }

        const update = await tx.grantee.updateMany({
          where: {
            id: grantee.id,
            status: { in: ["ACTIVE", "PROBATIONARY"] },
            entryAcademicYear: sourceTerm.academicYear,
            entrySemester: sourceTerm.semester,
          },
          data: {
            entryAcademicYear: destinationTerm.academicYear,
            entrySemester: destinationTerm.semester,
          },
        });
        if (!update.count) {
          skippedCount += 1;
          continue;
        }

        if (
          grantee.payout?.semester === sourceTerm.label &&
          grantee.payout.status === AccountingPayoutStatus.NOT_YET_FILED &&
          !grantee.payout.disbursedAt &&
          !grantee.payout.claimedAt
        ) {
          await tx.accountingPayout.updateMany({
            where: {
              id: grantee.payout.id,
              status: AccountingPayoutStatus.NOT_YET_FILED,
              disbursedAt: null,
              claimedAt: null,
              semester: sourceTerm.label,
            },
            data: { semester: destinationTerm.label },
          });
        }

        await writeAuditLog(tx, {
          action: "SYNC_GRANTEE_ENTRY_TERM",
          actorId: appUser.id,
          targetTable: "grantees",
          targetId: grantee.id,
          beforeData: {
            entryAcademicYear: sourceTerm.academicYear,
            entrySemester: sourceTerm.semester,
          },
          afterData: {
            entryAcademicYear: destinationTerm.academicYear,
            entrySemester: destinationTerm.semester,
          },
          metadata: { fromTerm: sourceTerm.label, toTerm: destinationTerm.label },
        });
        updatedCount += 1;
      }

      return { updatedCount, skippedCount };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      fromTerm: sourceTerm.label,
      toTerm: destinationTerm.label,
      updatedCount: result.updatedCount,
      skippedCount: result.skippedCount,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "Grantee records changed during sync. Reload the page and try again." },
        { status: 409 },
      );
    }
    console.error("Failed to sync grantee entry terms:", error);
    return NextResponse.json({ error: "Unable to sync grantee entry terms." }, { status: 500 });
  }
}
