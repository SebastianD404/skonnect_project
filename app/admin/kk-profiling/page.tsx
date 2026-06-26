import { prisma, getProfilingRegistrationCount, listProfilingRegistrations } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import Link from "next/link";

export default async function AdminKKProfilingPage() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const [registrations, totalCount] = await Promise.all([
    listProfilingRegistrations({
      orderBy: { submittedAt: "desc" },
      take: 100,
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    }),
    getProfilingRegistrationCount(),
  ]);

  const ageGroups = {
    "Child Youth (15-17 yrs old)": 0,
    "Core Youth (18-24 yrs old)": 0,
    "Young Adult (15-30 yrs old)": 0,
    Other: 0,
  } as Record<string, number>;

  const classifications = new Map<string, number>();
  const voters = { yes: 0, no: 0, unknown: 0 };
  const assemblies = { attended: 0, notAttended: 0 };

  registrations.forEach((registration) => {
    const group = registration.youthAgeGroup?.trim();
    if (group && ageGroups[group] !== undefined) {
      ageGroups[group] += 1;
    } else {
      ageGroups.Other += 1;
    }

    const classification = registration.youthClassification?.trim() || "Unknown";
    classifications.set(classification, (classifications.get(classification) ?? 0) + 1);

    const skVoter = registration.registeredSKVoter?.toLowerCase();
    if (skVoter === "yes") voters.yes += 1;
    else if (skVoter === "no") voters.no += 1;
    else voters.unknown += 1;

    if (registration.attendedKKAssembly === "Yes") {
      assemblies.attended += 1;
    } else {
      assemblies.notAttended += 1;
    }
  });

  const inSchoolYouthCount = classifications.get("In school Youth") ?? 0;
  const outOfSchoolYouthCount = classifications.get("Out of School Youth") ?? 0;
  const workingYouthCount = classifications.get("Working Youth") ?? 0;
  const latestRegistrations = registrations.slice(0, 50);

  return (
    <div className="min-h-screen bg-[#F8FBFF] text-slate-950">
      <div className="px-8 py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-10 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#0F3D5C]">KK Profiling</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
                  Registered youth profiling data
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                  Review Katipunan ng Kabataan profiling registrations submitted by SK officials and youth participants. Use this page to monitor demographic coverage, confirm SK voter status, and identify youth who still need follow-up.
                </p>
              </div>

              <div className="flex flex-col gap-3 rounded-[1.75rem] border border-slate-200 bg-slate-50 px-6 py-5 text-sm text-slate-700 shadow-sm">
                <span className="text-slate-500">Total KK registrations</span>
                <span className="text-4xl font-black text-[#0F3D5C]">{totalCount}</span>
                <Link
                  href="/admin"
                  className="inline-flex w-fit items-center justify-center rounded-full bg-[#0F3D5C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0D2E47]"
                >
                  Back to dashboard
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.75fr_0.9fr]">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm uppercase tracking-[0.35em] text-slate-500">In-school youth</p>
                <p className="mt-4 text-3xl font-black text-slate-950">{inSchoolYouthCount}</p>
                <p className="mt-2 text-sm text-slate-500">Profiles classified as in-school youth</p>
              </div>
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Out-of-school youth</p>
                <p className="mt-4 text-3xl font-black text-slate-950">{outOfSchoolYouthCount}</p>
                <p className="mt-2 text-sm text-slate-500">Profiles classified as out-of-school youth</p>
              </div>
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Working youth</p>
                <p className="mt-4 text-3xl font-black text-slate-950">{workingYouthCount}</p>
                <p className="mt-2 text-sm text-slate-500">Profiles classified as working youth</p>
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Youth classification</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">Breakdown</h2>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {Array.from(classifications.entries()).map(([classification, count]) => (
                  <div key={classification} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="text-sm text-slate-700">{classification}</span>
                    <span className="text-sm font-semibold text-slate-950">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-[#0F3D5C]">Latest entries</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Recent KK profiling submissions</h2>
                <p className="mt-2 text-sm text-slate-500">Showing the most recent {latestRegistrations.length} registration records.</p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">Name</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">Age group</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">Classification</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">SK Voter</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
                  {latestRegistrations.map((registration) => (
                    <tr key={registration.id}>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-950">
                          {registration.fullName}
                        </div>
                        <div className="text-xs text-slate-500">{registration.email}</div>
                      </td>
                      <td className="px-4 py-4">{registration.youthAgeGroup}</td>
                      <td className="px-4 py-4">{registration.youthClassification}</td>
                      <td className="px-4 py-4">{registration.registeredSKVoter}</td>
                      <td className="px-4 py-4 text-slate-500">
                        {new Date(registration.submittedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
