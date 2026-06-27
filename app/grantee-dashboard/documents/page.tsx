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
      grantee: {
        include: {
          submissions: {
            orderBy: { submittedAt: "desc" },
          },
        },
      },
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

  const submissions = appUser.grantee?.submissions ?? [];
  const serialized = submissions.map((submission) => ({
    id: submission.id,
    semester: submission.semester,
    status: submission.status,
    generalAverage: submission.generalAverage,
    reviewNotes: submission.reviewNotes,
    submittedAt: submission.submittedAt.toISOString(),
    reviewedAt: submission.reviewedAt ? submission.reviewedAt.toISOString() : null,
    gradeFileUrl: submission.gradeFileUrl,
    coeFileUrl: submission.coeFileUrl,
  }));

  const canSubmit = isGranteeProfileComplete(appUser.grantee);

  return (
    <main className="px-6 pb-20 pt-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-[#0F3D5C]">SKEAP Requirements</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Semester requirements center</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Submit your required semester files, monitor review progress, and check whether your submission was approved or returned for editing.
          </p>
        </div>

        <GranteeDocumentsClient submissions={serialized} canSubmit={canSubmit} />
      </div>
    </main>
  );
}
