"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Schedule = {
  semester: string;
  opensAt: string;
  closesAt: string;
};

type AssignedTerm = {
  term: string;
  count: number;
};

type ScheduleStatusResponse = {
  error?: string;
  academicTermSchedules?: Schedule[];
  activeGranteeTerms?: AssignedTerm[];
};

type StatusData = {
  schedules: Schedule[];
  activeGranteeTerms: AssignedTerm[];
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "Asia/Manila",
});
const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

function formatManilaDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${DATE_FORMATTER.format(date)}, ${TIME_FORMATTER.format(date)}`;
}

export default function SubmissionWindowStatus() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    async function loadStatus() {
      try {
        const response = await fetch("/api/admin-settings", { cache: "no-store" });
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("Invalid schedule status response.");
        }
        const result = data as ScheduleStatusResponse;
        if (!response.ok) throw new Error(result.error || "Unable to load submission window status.");
        if (active) {
          setStatus({
            schedules: result.academicTermSchedules ?? [],
            activeGranteeTerms: result.activeGranteeTerms ?? [],
          });
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    }

    void loadStatus();
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const activeSchedule = status?.schedules.find((schedule) => {
    const opensAt = new Date(schedule.opensAt).getTime();
    const closesAt = new Date(schedule.closesAt).getTime();
    return Number.isFinite(opensAt) && Number.isFinite(closesAt) && now >= opensAt && now <= closesAt;
  });
  const unscheduledGranteeCount = status?.activeGranteeTerms.reduce((total, assignedTerm) => {
    const hasOpenSchedule = status.schedules.some((schedule) => {
      const opensAt = new Date(schedule.opensAt).getTime();
      const closesAt = new Date(schedule.closesAt).getTime();
      return schedule.semester === assignedTerm.term &&
        Number.isFinite(opensAt) &&
        Number.isFinite(closesAt) &&
        now >= opensAt &&
        now <= closesAt;
    });
    return total + (hasOpenSchedule ? 0 : assignedTerm.count);
  }, 0) ?? 0;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600" aria-live="polite">
      {error ? (
        <span role="alert" className="text-rose-700">Active submission window status is unavailable.</span>
      ) : status ? (
        <span>
          <span className="font-semibold text-slate-700">Active Window:</span>{" "}
          {activeSchedule
            ? `${activeSchedule.semester} · Closes ${formatManilaDateTime(activeSchedule.closesAt) ?? "at an invalid date"}`
            : "No submission window is currently open"}
        </span>
      ) : (
        <span>Loading active submission window…</span>
      )}
      {unscheduledGranteeCount > 0 ? (
        <span className="inline-flex items-center gap-1 font-medium text-amber-800">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          {unscheduledGranteeCount} active grantee{unscheduledGranteeCount === 1 ? "" : "s"} on unscheduled terms
        </span>
      ) : null}
      <Link
        href="/admin/term-schedules"
        className="font-semibold text-cyan-800 underline-offset-2 hover:underline"
      >
        Manage Schedule →
      </Link>
    </div>
  );
}
