import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import SubmissionReviewTable from "./SubmissionReviewTable";

export default async function AdminSubmissionsPage() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let submissions: Array<{
    id: string;
    semester: string;
    gradeFileUrl: string;
    coeFileUrl: string;
    generalAverage: number | null;
    status: "PENDING" | "APPROVED" | "REJECTED" | "RETURNED_FOR_EDIT";
    reviewNotes: string | null;
    flaggedFields: string[];
    submittedAt: Date;
    grantee: {
      school: string;
      yearLevel: string;
      user: {
        fullName: string;
        email: string;
      };
    };
  }>;

  try {
    submissions = await prisma.submission.findMany({
      where: { status: "PENDING" },
      orderBy: { submittedAt: "asc" },
      select: {
        id: true,
        semester: true,
        gradeFileUrl: true,
        coeFileUrl: true,
        generalAverage: true,
        status: true,
        reviewNotes: true,
        flaggedFields: true,
        submittedAt: true,
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
          },
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/flaggedFields|does not exist/i.test(message)) {
      throw error;
    }

    const fallback = await prisma.submission.findMany({
      where: { status: "PENDING" },
      orderBy: { submittedAt: "asc" },
      select: {
        id: true,
        semester: true,
        gradeFileUrl: true,
        coeFileUrl: true,
        generalAverage: true,
        status: true,
        reviewNotes: true,
        submittedAt: true,
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
          },
        },
      },
    });

    submissions = fallback.map((item) => ({ ...item, flaggedFields: [] }));
  }

  const pendingCount = submissions.length;
  const serializedSubmissions = submissions.map((submission) => ({
    ...submission,
    submittedAt: submission.submittedAt.toISOString(),
  }));

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
                <span className="text-slate-500">Pending submissions</span>
                <span className="text-4xl font-black text-[#0F3D5C]">{pendingCount}</span>
                <Link
                  href="/admin"
                  className="inline-flex w-fit items-center justify-center rounded-full bg-[#0F3D5C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0D2E47]"
                >
                  Back to dashboard
                </Link>
              </div>
            </div>
          </div>

          <SubmissionReviewTable submissions={serializedSubmissions} />
        </div>
      </div>
    </div>
  );
}
