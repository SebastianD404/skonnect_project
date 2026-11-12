import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, PencilLine } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildGranteeActivity } from "@/lib/grantee-activity";

export default async function GranteeActivityPage() {
  const appUser = await requireRole(["GRANTEE"]);
  const grantee = await prisma.grantee.findUnique({
    where: { userId: appUser.id },
    select: {
      submissions: {
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          semester: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
        },
      },
      payout: {
        select: {
          id: true,
          semester: true,
          amount: true,
          claimedAt: true,
        },
      },
    },
  });
  const activities = buildGranteeActivity(grantee?.submissions ?? [], grantee?.payout ?? null);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      <Link
        href="/grantee-dashboard"
        className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-slate-600 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Dashboard
      </Link>

      <header className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Your account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Activity history</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Review your SKEAP submission updates and payout receipt confirmations.
        </p>
      </header>

      <section
        aria-label="All grantee activity"
        className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        {activities.length ? (
          <ol className="divide-y divide-slate-100">
            {activities.map((activity) => {
              const isAttention = activity.kind === "attention";
              const isApproved = activity.kind === "approved" || activity.kind === "confirmed";
              const tone = isAttention
                ? "bg-rose-100 text-rose-700"
                : isApproved
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-sky-100 text-sky-700";

              return (
                <li key={activity.id} className="flex items-start gap-4 px-5 py-4 sm:px-6">
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
                    {isApproved ? (
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    ) : isAttention ? (
                      <PencilLine className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Clock3 className="h-4 w-4" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{activity.label}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {activity.detail ? `${activity.detail} · ` : ""}
                      {activity.date.toLocaleDateString("en-PH", {
                        dateStyle: "medium",
                        timeZone: "Asia/Manila",
                      })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="px-6 py-14 text-center">
            <p className="font-medium text-slate-900">No activity yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Your submission updates and payout receipt confirmations will appear here.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
