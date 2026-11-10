import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { databaseUnavailableResponse } from "@/lib/database-errors";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const activeReviewStatuses = new Set([
  "pending",
  "pending verification",
  "resubmitted",
  "returned",
]);

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const appUser = await ensureProfile(user);
    if (!appUser) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const registration = await prisma.profilingRegistration.findFirst({
      where: { userId: appUser.id },
      orderBy: { submittedAt: "desc" },
      select: { reviewStatus: true },
    });
    const status = registration?.reviewStatus?.trim().toLowerCase() || "pending";

    return NextResponse.json({
      hasPendingApplication: Boolean(registration) && activeReviewStatuses.has(status),
    });
  } catch (error) {
    const unavailable = databaseUnavailableResponse(error, "GET /api/my/kk-profiling-application");
    if (unavailable) return unavailable;
    throw error;
  }
}
