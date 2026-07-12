import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import SubmissionReviewTable from "./SubmissionReviewTable";

type Submission = {
  id: string;
  semester: string;
  gradeFileUrl: string;
  coeFileUrl: string;
  gradeRows?: Array<{ subject: string; grade: number }> | null;
  generalAverage: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RETURNED_FOR_EDIT";
  reviewNotes: string | null;
  flaggedFields: string[];
  submittedAt: string;
  grantee: {
    school: string;
    yearLevel: string;
    user: {
      fullName: string;
      email: string;
    };
    generalAverage?: number | null;
  };
};

type SubmissionsPhase = {
  pendingCoe: Submission[];
  activeScholars: Submission[];
  pendingGrades: Submission[];
  completed: Submission[];
};

async function fetchSubmissions(): Promise<SubmissionsPhase> {
  const baseSelect = {
    id: true,
    semester: true,
    gradeFileUrl: true,
    coeFileUrl: true,
    gradeRows: true,
    generalAverage: true,
    status: true,
    reviewNotes: true,
    flaggedFields: true,
    submittedAt: true,
    granteeId: true,
    grantee: {
      select: {
        school: true,
        yearLevel: true,
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
        // include grantee-level stored average as a fallback when submission average is missing
        generalAverage: true,
      },
    },
  };

  try {
    // Fetch all non-rejected submissions
    const allSubmissions = await prisma.submission.findMany({
      where: {
        status: { not: "REJECTED" },
      },
      orderBy: { submittedAt: "asc" },
      select: baseSelect,
    });

    function computeAverageFromGradeRows(rows?: Array<{ subject: string; grade: number }> | null): number | null {
      if (!rows || rows.length === 0) return null;
      const validGrades = rows
        .map((row) => Number(row.grade))
        .filter((value) => !Number.isNaN(value) && value >= 0 && value <= 100);
      if (validGrades.length === 0) return null;
      return Number((validGrades.reduce((sum, value) => sum + value, 0) / validGrades.length).toFixed(2));
    }

    const serializedSubmissions = allSubmissions.map((submission) => ({
      ...submission,
      generalAverage:
        submission.generalAverage ??
        computeAverageFromGradeRows(submission.gradeRows) ??
        submission.grantee.generalAverage ??
        null,
      submittedAt: submission.submittedAt.toISOString(),
    }));

    // DEBUG: log basic submission averages to help diagnose missing GPA values in the UI
    try {
      console.log("[fetchSubmissions] submission generalAverage snapshot:");
      for (const s of serializedSubmissions) {
        const name = s.grantee?.user?.fullName ?? "<no-name>";
        const email = s.grantee?.user?.email ?? "<no-email>";
        console.log(`id=${s.id} name=${name} email=${email} generalAverage=${s.generalAverage}`);
      }
    } catch (err) {
      // swallow any logging errors to avoid breaking the fetch
      console.error("[fetchSubmissions] logging error", err);
    }

    const completedKeys = new Set(
      serializedSubmissions
        .filter(
          (submission) =>
            submission.status === "APPROVED" &&
            submission.coeFileUrl &&
            submission.gradeFileUrl
        )
        .map((submission) => `${submission.granteeId}:${submission.semester}`)
    );

    const result: SubmissionsPhase = {
      pendingCoe: [],
      activeScholars: [],
      pendingGrades: [],
      completed: [],
    };

    const isCompletedSubmission = (submission: typeof serializedSubmissions[number]) =>
      submission.status === "APPROVED" &&
      submission.coeFileUrl &&
      submission.gradeFileUrl;

    // Categorize by phase
    for (const submission of serializedSubmissions) {
      const submissionKey = `${submission.granteeId}:${submission.semester}`;
      const completedForSameKey = completedKeys.has(submissionKey);
      if (completedForSameKey && !isCompletedSubmission(submission)) {
        continue;
      }

      if (submission.status === "PENDING" && submission.coeFileUrl) {
        // Phase 1: Pending COE review (has COE file, awaiting approval)
        if (!submission.gradeFileUrl) {
          result.pendingCoe.push(submission);
        } else {
          // Has both files but status is pending
          result.pendingGrades.push(submission);
        }
      } else if (submission.status === "APPROVED" && submission.coeFileUrl && !submission.gradeFileUrl) {
        // Phase 2: Active Scholar - COE approved, awaiting grade submission
        result.activeScholars.push(submission);
      } else if (submission.status === "PENDING" && submission.gradeFileUrl) {
        // Phase 2: Pending grades review
        result.pendingGrades.push(submission);
      } else if (submission.status === "APPROVED" && submission.coeFileUrl && submission.gradeFileUrl) {
        // Completed: Both documents approved
        result.completed.push(submission);
      } else if (submission.status === "RETURNED_FOR_EDIT") {
        // If returned for edit, show in the phase that needs editing
        if (submission.gradeFileUrl) {
          result.pendingGrades.push(submission);
        } else {
          result.pendingCoe.push(submission);
        }
      }
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/flaggedFields|does not exist/i.test(message)) {
      throw error;
    }

    // Fallback without flaggedFields
    const baseSelectFallback = {
      id: true,
      semester: true,
      gradeFileUrl: true,
      coeFileUrl: true,
      generalAverage: true,
      status: true,
      reviewNotes: true,
      submittedAt: true,
      granteeId: true,
      grantee: {
        select: {
          school: true,
          yearLevel: true,
          user: {
            select: {
              fullName: true,
              email: true,
            },
          },
          generalAverage: true,
        },
      },
    };

    const allSubmissions = await prisma.submission.findMany({
      where: {
        status: { not: "REJECTED" },
      },
      orderBy: { submittedAt: "asc" },
      select: baseSelectFallback,
    });

    const serializedSubmissions = allSubmissions.map((submission) => ({
      ...submission,
      flaggedFields: [],
      submittedAt: submission.submittedAt.toISOString(),
    }));

    const completedKeys = new Set(
      serializedSubmissions
        .filter(
          (submission) =>
            submission.status === "APPROVED" &&
            submission.coeFileUrl &&
            submission.gradeFileUrl
        )
        .map((submission) => `${submission.granteeId}:${submission.semester}`)
    );

    const result: SubmissionsPhase = {
      pendingCoe: [],
      activeScholars: [],
      pendingGrades: [],
      completed: [],
    };

    const isCompletedSubmission = (submission: typeof serializedSubmissions[number]) =>
      submission.status === "APPROVED" &&
      submission.coeFileUrl &&
      submission.gradeFileUrl;

    for (const submission of serializedSubmissions) {
      const submissionKey = `${submission.granteeId}:${submission.semester}`;
      const completedForSameKey = completedKeys.has(submissionKey);
      if (completedForSameKey && !isCompletedSubmission(submission)) {
        continue;
      }

      if (submission.status === "PENDING" && submission.coeFileUrl) {
        if (!submission.gradeFileUrl) {
          result.pendingCoe.push(submission);
        } else {
          result.pendingGrades.push(submission);
        }
      } else if (submission.status === "APPROVED" && submission.coeFileUrl && !submission.gradeFileUrl) {
        result.activeScholars.push(submission);
      } else if (submission.status === "PENDING" && submission.gradeFileUrl) {
        result.pendingGrades.push(submission);
      } else if (submission.status === "APPROVED" && submission.coeFileUrl && submission.gradeFileUrl) {
        result.completed.push(submission);
      } else if (submission.status === "RETURNED_FOR_EDIT") {
        if (submission.gradeFileUrl) {
          result.pendingGrades.push(submission);
        } else {
          result.pendingCoe.push(submission);
        }
      }
    }

    return result;
  }
}

export default async function AdminSubmissionsPage() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const submissions = await fetchSubmissions();
  const totalCount = submissions.pendingCoe.length + submissions.pendingGrades.length + submissions.activeScholars.length;

  return (
    <div className="min-h-screen bg-[#F8FBFF] text-slate-950">
      <div className="px-8 py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-10 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#0F3D5C]">Document review queue</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
                  Review scholarship documents
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-slate-500">
                  Approve compliant uploads or return specific files for correction with clear guidance.
                </p>
              </div>

              <div className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-6 py-5 text-sm text-slate-700 shadow-sm">
                <span className="text-slate-500">Total awaiting action</span>
                <span className="text-4xl font-black text-[#0F3D5C]">{totalCount}</span>
                <Link
                  href="/admin"
                  className="inline-flex w-fit items-center justify-center rounded-full bg-[#0F3D5C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0D2E47]"
                >
                  Back to dashboard
                </Link>
              </div>
            </div>
          </div>

          <SubmissionReviewTable submissions={submissions} />
        </div>
      </div>
    </div>
  );
}
