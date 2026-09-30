import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { exportToExcel } from "@/lib/utils/export";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const submissions = await prisma.submission.findMany({
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    select: {
      semester: true,
      gradeFileUrl: true,
      coeFileUrl: true,
      generalAverage: true,
      status: true,
      submittedAt: true,
      grantee: {
        select: {
          school: true,
          yearLevel: true,
          user: { select: { fullName: true, email: true } },
        },
      },
    },
  });

  const file = exportToExcel(
    submissions.map((submission) => ({
      fullName: submission.grantee.user.fullName,
      email: submission.grantee.user.email,
      semester: submission.semester,
      school: submission.grantee.school,
      yearLevel: submission.grantee.yearLevel,
      generalAverage: submission.generalAverage,
      status: submission.status,
      submittedAt: submission.submittedAt,
      coeFileUrl: submission.coeFileUrl,
      gradeFileUrl: submission.gradeFileUrl,
    })),
    "document-submissions",
    "submissions"
  );

  return new NextResponse(file.body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}