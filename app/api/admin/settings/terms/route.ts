import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { MAX_SCHEDULED_TERMS } from "@/lib/academic-term-schedule-constants";
import { parseManilaDateTime } from "@/lib/academic-term-schedule";
import { isAllowedAcademicSemester } from "@/lib/semester-progress";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await ensureProfile(user);
    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload: unknown = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "Invalid academic term request." }, { status: 400 });
    }

    const { semester, opensAt: opensAtValue, closesAt: closesAtValue } = payload as Record<string, unknown>;
    const opensAt = parseManilaDateTime(opensAtValue);
    const closesAt = parseManilaDateTime(closesAtValue);
    if (typeof semester !== "string" || !isAllowedAcademicSemester(semester) || !opensAt || !closesAt || opensAt >= closesAt) {
      return NextResponse.json(
        { error: "Provide a valid academic term, opening date, and later deadline. Times use Asia/Manila." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingSchedules = await tx.academicTermSchedule.findMany({
        orderBy: { opensAt: "asc" },
        select: { id: true, semester: true, opensAt: true, closesAt: true },
      });
      if (existingSchedules.length >= MAX_SCHEDULED_TERMS) {
        return { error: `Maximum limit reached (${MAX_SCHEDULED_TERMS} terms).`, status: 409 as const };
      }
      if (existingSchedules.some((schedule) => schedule.semester === semester)) {
        return { error: `A schedule already exists for ${semester}.`, status: 409 as const };
      }

      const allSchedules = [...existingSchedules, { opensAt, closesAt }].sort(
        (left, right) => left.opensAt.getTime() - right.opensAt.getTime()
      );
      for (let index = 1; index < allSchedules.length; index += 1) {
        if (allSchedules[index].opensAt <= allSchedules[index - 1].closesAt) {
          return {
            error: "Academic submission windows cannot overlap. Adjust the opening date or deadline.",
            status: 400 as const,
          };
        }
      }

      const createdSchedule = await tx.academicTermSchedule.create({
        data: { semester, opensAt, closesAt },
      });
      await writeAuditLog(tx, {
        action: "UPDATE_ACADEMIC_TERM_SCHEDULE",
        actorId: appUser.id,
        targetTable: "academic_term_schedules",
        targetId: createdSchedule.id,
        beforeData: null,
        afterData: createdSchedule,
        metadata: { target: createdSchedule.semester },
      });

      return {
        createdSchedule,
        academicTermSchedules: [...existingSchedules, createdSchedule].sort(
          (left, right) => left.opensAt.getTime() - right.opensAt.getTime()
        ),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      createdSchedule: {
        ...result.createdSchedule,
        opensAt: result.createdSchedule.opensAt.toISOString(),
        closesAt: result.createdSchedule.closesAt.toISOString(),
      },
      academicTermSchedules: result.academicTermSchedules.map((schedule) => ({
        ...schedule,
        opensAt: schedule.opensAt.toISOString(),
        closesAt: schedule.closesAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "Schedules changed while saving. Reload settings and try again." },
        { status: 409 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A schedule already exists for this academic term. Reload settings and try again." },
        { status: 409 }
      );
    }
    console.error("Failed to create academic term schedule:", error);
    return NextResponse.json({ error: "Failed to save the academic term. Please try again." }, { status: 500 });
  }
}
