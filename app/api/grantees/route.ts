import { NextResponse } from "next/server";
import { GranteeStatus, Role } from "@prisma/client";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { formatDisplayName } from "@/lib/display-name";
import {
  accountingTermForDate,
  accountingTermsMatch,
  compareAccountingTerms,
  getAccountingTermOptions,
  normalizeAccountingTerm,
  normalizeAccountingTermParts,
} from "@/lib/accounting-term";
import {
  getAccountingSubmissionState,
} from "@/lib/accounting-submission";

const db = prisma;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await ensureProfile(user);
    if (!appUser || (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const schedules = await db.academicTermSchedule.findMany({
      select: { semester: true, opensAt: true, closesAt: true },
    });
    const termOptions = getAccountingTermOptions(schedules);
    const requestedSemester = url.searchParams.get("semester");
    const defaultSemester =
      termOptions.find((term) => term.isCurrent)?.name ?? termOptions[0]?.name ?? "";
    const selectedSemester = normalizeAccountingTerm(requestedSemester || defaultSemester);
    if (!selectedSemester) {
      return NextResponse.json({ error: "A valid semester is required." }, { status: 400 });
    }

    const claimedParam = url.searchParams.get("claimed");
    const claimedFilter = claimedParam === "true" ? true : claimedParam === "false" ? false : null;
    const requestedPage = Number(url.searchParams.get("page") ?? "1");
    const requestedLimit = Number(url.searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE));
    const page = Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1;
    const limit = Number.isSafeInteger(requestedLimit)
      ? Math.min(MAX_PAGE_SIZE, Math.max(1, requestedLimit))
      : DEFAULT_PAGE_SIZE;
    const shouldPaginate = url.searchParams.has("page") || url.searchParams.has("limit");
    const where = {
      status: { in: [GranteeStatus.ACTIVE, GranteeStatus.PROBATIONARY] },
      user: {
        is: {
          isActive: true,
          role: Role.GRANTEE,
        },
      },
    };

    const rows = await db.grantee.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        where,
        select: {
          id: true,
          userId: true,
          entryAcademicYear: true,
          entrySemester: true,
          dateEnrolled: true,
          user: {
            select: {
              fullName: true,
              email: true,
              kkProfile: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                },
              },
            },
          },
          submissions: {
            orderBy: { submittedAt: "desc" },
            select: { status: true, semester: true, submittedAt: true },
          },
          payout: {
            select: {
              status: true,
              disbursedAt: true,
              claimedAt: true,
              disbursementEmailSentAt: true,
              semester: true,
            },
          },
        },
      });

    const approvedApplications = rows.length > 0
      ? await db.skeapApplication.findMany({
          where: {
            userId: { in: rows.map((grantee) => grantee.userId) },
            status: "APPROVED",
          },
          select: { userId: true, submittedAt: true },
        })
      : [];
    const approvedApplicationsByUser = new Map<string, Date[]>();
    for (const application of approvedApplications) {
      const applications = approvedApplicationsByUser.get(application.userId) ?? [];
      applications.push(application.submittedAt);
      approvedApplicationsByUser.set(application.userId, applications);
    }

    const scopedRows = rows.flatMap((grantee) => {
      const entryTerm =
        normalizeAccountingTermParts(grantee.entryAcademicYear, grantee.entrySemester) ??
        accountingTermForDate(schedules, grantee.dateEnrolled);
      const termSubmissions = grantee.submissions.filter((submission) =>
        accountingTermsMatch(submission.semester, selectedSemester)
      );
      const payoutMatchesTerm =
        grantee.payout !== null &&
        accountingTermsMatch(grantee.payout.semester, selectedSemester);
      const payout = payoutMatchesTerm ? grantee.payout : null;
      const payoutDisbursed = Boolean(
        payout &&
          (payout.disbursedAt ||
            payout.status === "DISBURSED_UNCONFIRMED" ||
            payout.status === "CONFIRMED"),
      );
      const approvedApplicationMatchesTerm = (approvedApplicationsByUser.get(grantee.userId) ?? [])
        .some((submittedAt) => {
          const applicationTerm = accountingTermForDate(schedules, submittedAt);
          return accountingTermsMatch(applicationTerm, selectedSemester);
        });
      const hasTermRecord =
        termSubmissions.length > 0 || approvedApplicationMatchesTerm || payoutMatchesTerm;
      const entryTermOrder = compareAccountingTerms(entryTerm, selectedSemester);
      const entryTermIsOnOrBeforeSelected =
        accountingTermsMatch(entryTerm, selectedSemester) ||
        (entryTermOrder !== null && entryTermOrder < 0);

      if (!entryTermIsOnOrBeforeSelected && !hasTermRecord) return [];
      if (
        claimedFilter === true &&
        !payoutDisbursed
      ) return [];
      if (claimedFilter === false && payoutDisbursed) return [];

      const submission = termSubmissions[0] ?? null;
      const submissionState = submission
        ? getAccountingSubmissionState(submission.status)
        : approvedApplicationMatchesTerm
          ? "Approved"
          : "Not submitted";
      const claimed = payoutDisbursed;
      const claimedAt = payout?.claimedAt ?? null;
      const disbursedAt = payout?.disbursedAt ?? null;

      return [{
        id: grantee.id,
        student_name: formatDisplayName(grantee.user?.kkProfile, grantee.user?.fullName ?? ""),
        email: grantee.user?.email ?? null,
        accountName: grantee.user?.fullName ?? "",
        semester: selectedSemester,
        submitted: submissionState !== "Not submitted",
        submissionStatus: submissionState,
        submissionState,
        claimed,
        claimedAt,
        disbursedAt,
        disbursementEmailSentAt: payout?.disbursementEmailSentAt ?? null,
        payoutStatus: payout?.status ?? "PENDING",
      }];
    });
    const totalCount = scopedRows.length;
    const mapped = shouldPaginate
      ? scopedRows.slice((page - 1) * limit, page * limit)
      : scopedRows;

    return NextResponse.json({ grantees: mapped, totalCount, page, limit });
  } catch (error) {
    console.error("/api/grantees error:", error);
    return NextResponse.json({ error: "Unable to load grantees." }, { status: 500 });
  }
}
