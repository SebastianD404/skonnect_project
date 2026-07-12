import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import GranteeDocumentsClient from "./GranteeDocumentsClient";
import { isGranteeProfileComplete } from "@/lib/grantee-profile";

export default async function GranteeDocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await prisma.user.findFirst({
    where: {
      OR: [{ authId: user.id }, { email: user.email ?? "" }],
    },
    include: {
      grantee: true,
    },
  });

  if (appUser && appUser.authId !== user.id) {
    try {
      await prisma.user.update({
        where: { id: appUser.id },
        data: { authId: user.id },
      });
    } catch {
      // Ignore relink failures and continue with fetched account data.
    }
  }

  if (!appUser || appUser.role !== "GRANTEE") {
    redirect("/login");
  }

  let submissions: Array<{
    id: string;
    semester: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "RETURNED_FOR_EDIT";
    generalAverage: number | null;
    gradeRows?: Array<{ subject: string; grade: number }> | null;
    reviewNotes: string | null;
    flaggedFields: string[];
    submittedAt: Date;
    reviewedAt: Date | null;
    gradeFileUrl: string;
    coeFileUrl: string;
  }> = [];

  if (appUser.grantee?.id) {
    try {
      const raw = await prisma.submission.findMany({
        where: { granteeId: appUser.grantee.id },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          semester: true,
          status: true,
          generalAverage: true,
          gradeRows: true,
          reviewNotes: true,
          flaggedFields: true,
          submittedAt: true,
          reviewedAt: true,
          gradeFileUrl: true,
          coeFileUrl: true,
        },
      }) as any[];

      function normalizeGradeRows(rows: unknown): Array<{ subject: string; grade: number }> | null {
        if (!rows) return null;
        let parsed: any = rows;
        if (typeof rows === "string") {
          try {
            parsed = JSON.parse(rows);
          } catch (e) {
            return null;
          }
        }
        if (!Array.isArray(parsed) || parsed.length === 0) return null;
        const normalized = parsed
          .map((r: any) => ({ subject: String(r?.subject ?? "").trim(), grade: Number(r?.grade) }))
          .filter((r: any) => !Number.isNaN(r.grade) && r.subject.length > 0 && r.grade >= 0 && r.grade <= 100);
        return normalized.length > 0 ? normalized : null;
      }

      submissions = raw.map((item) => ({
        ...item,
        gradeRows: normalizeGradeRows(item.gradeRows),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/flaggedFields|does not exist/i.test(message)) {
        throw error;
      }

      const fallback = await prisma.submission.findMany({
        where: { granteeId: appUser.grantee.id },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          semester: true,
          status: true,
          generalAverage: true,
          reviewNotes: true,
          submittedAt: true,
          reviewedAt: true,
          gradeFileUrl: true,
          coeFileUrl: true,
        },
      });

      submissions = fallback.map((item) => ({ ...item, flaggedFields: [] }));
    }
  }

  

  function computeAverageFromGradeRows(rows?: Array<{ subject: string; grade: number }> | null): number | null {
    if (!rows || rows.length === 0) return null;
    const validGrades = rows
      .map((row) => Number(row.grade))
      .filter((value) => !Number.isNaN(value) && value >= 0 && value <= 100);
    if (validGrades.length === 0) return null;
    return Number((validGrades.reduce((sum, value) => sum + value, 0) / validGrades.length).toFixed(2));
  }

  const serialized = submissions.map((submission) => ({
    id: submission.id,
    semester: submission.semester,
    status: submission.status,
    generalAverage: submission.generalAverage ?? computeAverageFromGradeRows(submission.gradeRows),
    reviewNotes: submission.reviewNotes,
    flaggedFields: submission.flaggedFields,
    submittedAt: submission.submittedAt.toISOString(),
    reviewedAt: submission.reviewedAt ? submission.reviewedAt.toISOString() : null,
    gradeFileUrl: submission.gradeFileUrl,
    coeFileUrl: submission.coeFileUrl,
  }));

  const canSubmit = isGranteeProfileComplete(appUser.grantee);

  return (
    <main className="px-6 pb-20 pt-12">
      <div className="mx-auto max-w-7xl">
        <GranteeDocumentsClient submissions={serialized} canSubmit={canSubmit} />
      </div>
    </main>
  );
}
