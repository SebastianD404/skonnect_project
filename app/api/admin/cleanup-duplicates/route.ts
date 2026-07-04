import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function POST() {
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

    // Get all grantees and check for duplicates by semester
    const allSubmissions = await prisma.submission.findMany({
      include: { grantee: { include: { user: true } } },
      orderBy: [{ granteeId: "asc" }, { semester: "asc" }, { submittedAt: "desc" }],
    });

    const byGranteeSemester = new Map<string, typeof allSubmissions>();
    for (const sub of allSubmissions) {
      const key = `${sub.granteeId}|${sub.semester}`;
      if (!byGranteeSemester.has(key)) {
        byGranteeSemester.set(key, []);
      }
      byGranteeSemester.get(key)!.push(sub);
    }

    let deletedCount = 0;
    const deletedRecords: Array<{ grantee: string; semester: string; id: string }> = [];

    // For each grantee/semester with duplicates, keep the best one and delete others
    for (const [key, subs] of byGranteeSemester) {
      if (subs.length > 1) {
        const [, semester] = key.split("|");
        const granteeName = subs[0].grantee?.user?.fullName || "Unknown";

        // Keep the one with gradeFileUrl, or the most recent
        const withGrades = subs.find((s) => s.gradeFileUrl);
        const toKeep = withGrades || subs[0];
        const toDelete = subs.filter((s) => s.id !== toKeep.id);

        for (const sub of toDelete) {
          await prisma.submission.delete({ where: { id: sub.id } });
          deletedRecords.push({ grantee: granteeName, semester, id: sub.id });
          deletedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} duplicate submission(s)`,
      deleted: deletedRecords,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cleanup duplicates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
