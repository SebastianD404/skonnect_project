import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { ensureProfile } from "@/lib/auth";
import { dispatchPayout } from "@/lib/payout-disbursement";
import { createClient } from "@/lib/supabase/server";
import { getRecentSemesters } from "@/lib/semester";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, error: "Missing grantee ID." }, { status: 400 });

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

    const actor = await ensureProfile(user);
    if (!actor || (actor.role !== Role.SK_OFFICIAL && actor.role !== Role.SUPER_ADMIN)) {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (body && typeof body === "object" && "claimed" in body && body.claimed === false) {
      return NextResponse.json(
        { ok: false, error: "A disbursed payout cannot be unmarked. Confirmations are recorded by the grantee." },
        { status: 409 },
      );
    }
    const requestedSemester =
      body && typeof body === "object" && "semester" in body && typeof body.semester === "string"
        ? body.semester.trim()
        : "";
    if (requestedSemester.length > 120) {
      return NextResponse.json({ ok: false, error: "Semester name is too long." }, { status: 400 });
    }

    const result = await dispatchPayout({
      granteeId: id,
      semester: requestedSemester || getRecentSemesters()[0].name,
      actorId: actor.id,
    });

    return NextResponse.json({
      ok: true,
      status: result.payout.status,
      emailStatus: result.emailStatus,
      ...(result.emailError ? { emailError: result.emailError } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to dispatch payout.";
    console.error("Could not dispatch grantee payout:", { granteeId: id, error });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
