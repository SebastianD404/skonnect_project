import { prisma } from "@/lib/prisma";

export type AcademicTermScheduleRecord = {
  id: string;
  semester: string;
  opensAt: Date;
  closesAt: Date;
};

export type AcademicTermWindow = {
  status: "OPEN" | "UPCOMING" | "CLOSED" | "UNCONFIGURED";
  semester: string | null;
  opensAt: string | null;
  closesAt: string | null;
};

export function resolveAcademicTermWindow(
  schedules: AcademicTermScheduleRecord[],
  now = new Date()
): AcademicTermWindow {
  const ordered = [...schedules].sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime());
  const open = ordered.find(
    (schedule) => schedule.opensAt.getTime() <= now.getTime() && schedule.closesAt.getTime() >= now.getTime()
  );

  if (open) {
    return {
      status: "OPEN",
      semester: open.semester,
      opensAt: open.opensAt.toISOString(),
      closesAt: open.closesAt.toISOString(),
    };
  }

  const upcoming = ordered.find((schedule) => schedule.opensAt.getTime() > now.getTime());
  if (upcoming) {
    return {
      status: "UPCOMING",
      semester: upcoming.semester,
      opensAt: upcoming.opensAt.toISOString(),
      closesAt: upcoming.closesAt.toISOString(),
    };
  }

  const latest = ordered[ordered.length - 1];
  if (latest) {
    return {
      status: "CLOSED",
      semester: latest.semester,
      opensAt: latest.opensAt.toISOString(),
      closesAt: latest.closesAt.toISOString(),
    };
  }

  return { status: "UNCONFIGURED", semester: null, opensAt: null, closesAt: null };
}

export async function getAcademicTermScheduleState(now = new Date()) {
  const schedules = await prisma.academicTermSchedule.findMany({
    orderBy: { opensAt: "asc" },
    select: { id: true, semester: true, opensAt: true, closesAt: true },
  });

  return {
    schedules,
    window: resolveAcademicTermWindow(schedules, now),
  };
}

export function parseManilaDateTime(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const timestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - 8,
    Number(minute)
  );
  const date = new Date(timestamp);
  const roundTrip = new Date(timestamp + 8 * 60 * 60 * 1000);

  if (
    roundTrip.getUTCFullYear() !== Number(year) ||
    roundTrip.getUTCMonth() !== Number(month) - 1 ||
    roundTrip.getUTCDate() !== Number(day) ||
    roundTrip.getUTCHours() !== Number(hour) ||
    roundTrip.getUTCMinutes() !== Number(minute)
  ) {
    return null;
  }

  return date;
}

export function formatManilaDateTime(value: Date) {
  const manilaTime = new Date(value.getTime() + 8 * 60 * 60 * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${manilaTime.getUTCFullYear()}-${pad(manilaTime.getUTCMonth() + 1)}-${pad(manilaTime.getUTCDate())}T${pad(manilaTime.getUTCHours())}:${pad(manilaTime.getUTCMinutes())}`;
}
