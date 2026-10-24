import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { Prisma, Role, ReminderType } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { ensureProfile } from "../../../lib/auth";
import { parseReminderOffsets } from "../../../lib/reminders";
import { writeAuditLog } from "../../../lib/audit/logger";
import { getAcademicTermScheduleState, parseManilaDateTime } from "@/lib/academic-term-schedule";
import { MAX_SCHEDULED_TERMS } from "@/lib/academic-term-schedule-constants";
import { isAllowedAcademicSemester } from "@/lib/semester-progress";

const DEFAULT_SETTINGS = {
  inquiryAlerts: true,
  submissionAlerts: true,
  skeapReminderOffsets: "7, 3, 1",
};

type AppUserWithSettings = {
  id: string;
  authId: string;
  email: string;
  fullName: string;
  role: Role;
  settings: { inquiryAlerts: boolean; submissionAlerts: boolean } | null;
};

async function getAppUser(authUser: { id?: string; user?: { id?: string } }): Promise<AppUserWithSettings | null> {
  const linkedUser = await ensureProfile(authUser);
  if (!linkedUser) return null;
  const user = await prisma.user.findUnique({ where: { id: linkedUser.id } });
  return user as unknown as AppUserWithSettings | null;
}

async function getReminderSettings() {
  const skeap = await prisma.reminderSetting.findUnique({
    where: { type: ReminderType.SKEAP_APPLICATION },
    select: { offsets: true },
  });

  const skeapOffsets = Array.isArray(skeap?.offsets) ? skeap.offsets : [];

  return {
    skeapReminderOffsets: skeapOffsets.length > 0 ? skeapOffsets.join(", ") : DEFAULT_SETTINGS.skeapReminderOffsets,
  };
}

async function upsertReminderSetting(
  client: Prisma.TransactionClient,
  type: ReminderType,
  offsets: number[]
) {
  return client.reminderSetting.upsert({
    where: { type },
    create: {
      type,
      offsets,
      deadline: null,
    },
    update: {
      offsets,
      deadline: null,
    },
  });
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await getAppUser(user);
    if (!appUser || (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const reminderSettings = await getReminderSettings();
    const { schedules: academicTermSchedules, window: academicTermWindow } =
      await getAcademicTermScheduleState();

    return NextResponse.json({
      fullName: appUser.fullName ?? "",
      email: appUser.email,
      settings: appUser.settings ?? DEFAULT_SETTINGS,
      reminderSettings,
      academicTermSchedules: academicTermSchedules.map((schedule) => ({
        ...schedule,
        opensAt: schedule.opensAt.toISOString(),
        closesAt: schedule.closesAt.toISOString(),
      })),
      academicTermWindow,
    });
  } catch (error) {
    console.error("Failed to load admin and academic term settings:", error);
    return NextResponse.json({ error: "Unable to load settings. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUser = await getAppUser(user);
  if (!appUser || (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid settings request." }, { status: 400 });
  }
  const {
    fullName,
    email,
    newPassword,
    confirmPassword,
    inquiryAlerts,
    submissionAlerts,
    skeapReminderOffsets,
    academicTermSchedules,
    deletedAcademicTermScheduleIds,
  } = payload;

  let parsedAcademicTermSchedules:
    | Array<{ id?: string; semester: string; opensAt: Date; closesAt: Date }>
    | undefined;
  let existingSchedules: Array<{
    id: string;
    semester: string;
    opensAt: Date;
    closesAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  if (academicTermSchedules !== undefined) {
    if (!Array.isArray(academicTermSchedules) || academicTermSchedules.length > 30) {
      return NextResponse.json({ error: "Provide a valid academic term schedule list." }, { status: 400 });
    }
    parsedAcademicTermSchedules = [];
    const semesterNames = new Set<string>();
    for (const item of academicTermSchedules) {
      const semester = typeof item?.semester === "string" ? item.semester.trim() : "";
      const opensAt = parseManilaDateTime(item?.opensAt);
      const closesAt = parseManilaDateTime(item?.closesAt);
      if (!isAllowedAcademicSemester(semester) || !opensAt || !closesAt || opensAt >= closesAt) {
        return NextResponse.json(
          { error: "Each schedule needs a valid academic term, opening date, and later deadline. Times use Asia/Manila." },
          { status: 400 }
        );
      }
      if (semesterNames.has(semester)) {
        return NextResponse.json({ error: `A schedule already exists for ${semester}.` }, { status: 400 });
      }
      semesterNames.add(semester);
      parsedAcademicTermSchedules.push({
        ...(typeof item.id === "string" ? { id: item.id } : {}),
        semester,
        opensAt,
        closesAt,
      });
    }
    if (
      deletedAcademicTermScheduleIds !== undefined &&
      (!Array.isArray(deletedAcademicTermScheduleIds) ||
        deletedAcademicTermScheduleIds.some((id) => typeof id !== "string"))
    ) {
      return NextResponse.json({ error: "Invalid academic schedule removal list." }, { status: 400 });
    }
    const parsedSchedules = parsedAcademicTermSchedules ?? [];
    const deletedIds = (deletedAcademicTermScheduleIds ?? []) as string[];
    if (
      new Set(deletedIds).size !== deletedIds.length ||
      deletedIds.some((id) => parsedSchedules.some((schedule) => schedule.id === id))
    ) {
      return NextResponse.json({ error: "An academic schedule cannot be edited and removed at the same time." }, { status: 400 });
    }
    existingSchedules = await prisma.academicTermSchedule.findMany({
      select: { id: true, semester: true, opensAt: true, closesAt: true, createdAt: true, updatedAt: true },
    });
    const existingById = new Map(existingSchedules.map((schedule) => [schedule.id, schedule]));
    if (
      deletedIds.some((id) => !existingById.has(id)) ||
      parsedSchedules.some((schedule) => schedule.id && existingById.get(schedule.id)?.semester !== schedule.semester)
    ) {
      return NextResponse.json({ error: "An academic term schedule changed. Reload settings and try again." }, { status: 409 });
    }
    const persistedBySemester = new Set(existingSchedules.map((schedule) => schedule.semester));
    if (
      parsedSchedules.some(
        (schedule) => !schedule.id && persistedBySemester.has(schedule.semester) && !deletedIds.some((id) => existingById.get(id)?.semester === schedule.semester)
      )
    ) {
      return NextResponse.json({ error: "A schedule already exists for this academic term." }, { status: 409 });
    }
    const editedIds = new Set(parsedSchedules.flatMap((schedule) => schedule.id ? [schedule.id] : []));
    const removedIds = new Set(deletedIds);
    const newSemesters = new Set(parsedSchedules.filter((schedule) => !schedule.id).map((schedule) => schedule.semester));
    const untouchedSchedules = existingSchedules.filter(
      (schedule) =>
        !editedIds.has(schedule.id) &&
        !removedIds.has(schedule.id) &&
        !newSemesters.has(schedule.semester)
    );
    const allSchedules = [
      ...untouchedSchedules,
      ...parsedSchedules.map(({ semester, opensAt, closesAt }) => ({ semester, opensAt, closesAt })),
    ].sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime());
    if (allSchedules.length > MAX_SCHEDULED_TERMS) {
      return NextResponse.json(
        { error: `Maximum limit reached (${MAX_SCHEDULED_TERMS} terms).` },
        { status: 400 }
      );
    }
    for (let index = 1; index < allSchedules.length; index += 1) {
      if (allSchedules[index].opensAt <= allSchedules[index - 1].closesAt) {
        return NextResponse.json(
          { error: "Academic submission windows cannot overlap. Adjust the opening date or deadline." },
          { status: 400 }
        );
      }
    }
  }

  if (!fullName || !email) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  if (newPassword && newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  const authUpdatePayload: { email?: string; password?: string } = {};
  if (email !== appUser.email) {
    authUpdatePayload.email = email;
  }
  if (newPassword) {
    authUpdatePayload.password = newPassword;
  }

  if (Object.keys(authUpdatePayload).length > 0) {
    const { error: authError } = await supabase.auth.updateUser(authUpdatePayload);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  }

  try {
    const previousSettings = await getReminderSettings();
    const nextProfileSettings = {
      inquiryAlerts: Boolean(inquiryAlerts),
      submissionAlerts: Boolean(submissionAlerts),
    };

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: appUser.id },
        data: {
          fullName,
          email,
          settings: nextProfileSettings,
        } as unknown as Prisma.UserUpdateInput,
      });

      await upsertReminderSetting(
        tx,
        ReminderType.SKEAP_APPLICATION,
        parseReminderOffsets(String(skeapReminderOffsets ?? ""))
      );

      if (parsedAcademicTermSchedules) {
        const deletedScheduleIds = deletedAcademicTermScheduleIds as string[] | undefined;
        const deletedScheduleIdSet = new Set(deletedScheduleIds ?? []);
        if (deletedScheduleIds?.length) {
          const removedSchedules = await tx.academicTermSchedule.findMany({
            where: { id: { in: deletedScheduleIds } },
          });
          await tx.academicTermSchedule.deleteMany({ where: { id: { in: deletedScheduleIds } } });
          for (const schedule of removedSchedules) {
            await writeAuditLog(tx, {
              action: "DELETE_ACADEMIC_TERM_SCHEDULE",
              actorId: appUser.id,
              targetTable: "academic_term_schedules",
              targetId: schedule.id,
              beforeData: schedule,
              afterData: null,
              metadata: { target: schedule.semester },
            });
          }
        }

        const existingById = new Map(existingSchedules.map((schedule) => [schedule.id, schedule]));
        const existingBySemester = new Map(
          existingSchedules
            .filter((schedule) => !deletedScheduleIdSet.has(schedule.id))
            .map((schedule) => [schedule.semester, schedule])
        );
        for (const schedule of parsedAcademicTermSchedules) {
          const before = schedule.id
            ? existingById.get(schedule.id)
            : existingBySemester.get(schedule.semester);
          if (schedule.id && (!before || before.semester !== schedule.semester)) {
            throw new Error("An academic term schedule could not be found.");
          }
          const saved = schedule.id
            ? await tx.academicTermSchedule.update({
                where: { id: schedule.id },
                data: { opensAt: schedule.opensAt, closesAt: schedule.closesAt },
              })
            : await tx.academicTermSchedule.upsert({
                where: { semester: schedule.semester },
                create: {
                  semester: schedule.semester,
                  opensAt: schedule.opensAt,
                  closesAt: schedule.closesAt,
                },
                update: {
                  opensAt: schedule.opensAt,
                  closesAt: schedule.closesAt,
                },
              });
          await writeAuditLog(tx, {
            action: "UPDATE_ACADEMIC_TERM_SCHEDULE",
            actorId: appUser.id,
            targetTable: "academic_term_schedules",
            targetId: saved.id,
            beforeData: before,
            afterData: saved,
            metadata: { target: schedule.semester },
          });
        }
      }

      await writeAuditLog(tx, {
        action: "UPDATE_ADMIN_PROFILE_SETTINGS",
        actorId: appUser.id,
        targetTable: "users",
        targetId: appUser.id,
        beforeData: {
          fullName: appUser.fullName,
          email: appUser.email,
          settings: appUser.settings,
        },
        afterData: {
          fullName,
          email,
          settings: nextProfileSettings,
        },
      });

      await writeAuditLog(tx, {
        action: "UPDATE_REMINDER_SETTINGS",
        actorId: appUser.id,
        targetTable: "reminder_settings",
        targetId: ReminderType.SKEAP_APPLICATION,
        beforeData: previousSettings,
        afterData: {
          skeapReminderOffsets,
        },
        metadata: {
          target: appUser.fullName,
          targetId: appUser.id,
        },
      });
    });

    const { schedules: savedSchedules, window: academicTermWindow } =
      await getAcademicTermScheduleState();
    return NextResponse.json({
      success: true,
      academicTermSchedules: savedSchedules.map((schedule) => ({
        ...schedule,
        opensAt: schedule.opensAt.toISOString(),
        closesAt: schedule.closesAt.toISOString(),
      })),
      academicTermWindow,
    });
  } catch (error) {
    console.error("Failed to update admin and academic term settings:", error);
    return NextResponse.json({ error: "Failed to update settings." }, { status: 500 });
  }
}
