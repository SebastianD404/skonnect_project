import { NextResponse } from "next/server";
import { GranteeStatus, Role } from "@prisma/client";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { formatDisplayName } from "@/lib/display-name";
import {
  getAccountingSubmissionState,
  isAccountingSubmissionSubmitted,
} from "@/lib/accounting-submission";

const db = prisma;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const normalizeSemester = (value?: string | null) => String(value ?? "").replace(/\s*\(current\)$/i, "").trim();

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
    const semester = url.searchParams.get("semester");
    const normalizedSemester = normalizeSemester(semester);
    const claimedParam = url.searchParams.get("claimed");
    const claimedFilter = claimedParam === "true" ? true : claimedParam === "false" ? false : null;
    const requestedPage = Number(url.searchParams.get("page") ?? "1");
    const requestedLimit = Number(url.searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE));
    const page = Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1;
    const limit = Number.isSafeInteger(requestedLimit)
      ? Math.min(MAX_PAGE_SIZE, Math.max(1, requestedLimit))
      : DEFAULT_PAGE_SIZE;
    const where = {
      status: { in: [GranteeStatus.ACTIVE, GranteeStatus.PROBATIONARY] },
      user: {
        is: {
          isActive: true,
          role: Role.GRANTEE,
        },
      },
      ...(claimedFilter === true
        ? { payout: { is: { disbursedAt: { not: null } } } }
        : claimedFilter === false
          ? {
              OR: [
                { payout: { is: null } },
                { payout: { is: { disbursedAt: null } } },
              ],
            }
          : {}),
    };

    const [totalCount, rows] = await Promise.all([
      db.grantee.count({ where }),
      db.grantee.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              fullName: true,
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
            where: {
              ...(normalizedSemester && {
                semester: { equals: normalizedSemester, mode: "insensitive" as const },
              }),
            },
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: { id: true, status: true, semester: true, submittedAt: true },
          },
          payout: {
            select: {
              status: true,
              disbursedAt: true,
              claimedAt: true,
              disbursementEmailSentAt: true,
            },
          },
        },
      }),
    ]);

    const mapped = rows.map((g) => {
      const submission = g.submissions?.[0] ?? null;
      const rawStatus = submission?.status ?? null;
      const submitted = isAccountingSubmissionSubmitted(rawStatus);

      const payout = g.payout;
      const claimed = !!(payout && payout.disbursedAt);
      const claimedAt = payout?.claimedAt ?? null;
      const disbursedAt = payout?.disbursedAt ?? null;

      return {
        id: g.id,
        student_name: formatDisplayName(g.user?.kkProfile, g.user?.fullName ?? ""),
        accountName: g.user?.fullName ?? "",
        semester: submission?.semester ?? normalizedSemester ?? "",
        submitted,
        submissionStatus: rawStatus,
        submissionState: getAccountingSubmissionState(rawStatus),
        claimed,
        claimedAt,
        disbursedAt,
        disbursementEmailSentAt: payout?.disbursementEmailSentAt ?? null,
        payoutStatus: payout?.status ?? "PENDING",
      };
    });

    return NextResponse.json({ grantees: mapped, totalCount, page, limit });
  } catch (error) {
    console.error("/api/grantees error:", error);
    return NextResponse.json({ error: "Unable to load grantees." }, { status: 500 });
  }
}
