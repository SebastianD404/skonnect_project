import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import KKProfilingForm from "@/app/programs/kk-profiling-form";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export default async function KkProfilingOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/signup?next=%2Fprograms%2Fkk-profiling");
  }

  const appUser = await ensureProfile(authUser);
  if (!appUser) {
    redirect("/login?next=%2Fprograms%2Fkk-profiling");
  }

  const userWithKkData = await prisma.user.findUnique({
    where: { id: appUser.id },
    select: {
      kkProfile: { select: { isVerified: true } },
      profilingRegistrations: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { reviewStatus: true },
      },
    },
  });
  const latestStatus =
    userWithKkData?.profilingRegistrations?.[0]?.reviewStatus ||
    (userWithKkData?.kkProfile?.isVerified ? "Approved" : undefined);

  if (latestStatus?.toLowerCase().includes("approved")) {
    redirect("/programs/kk-profiling/status");
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
      <ol
        aria-label="Onboarding progress"
        className="mx-auto mb-6 grid max-w-4xl grid-cols-3 items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-8 sm:p-5"
      >
        <li className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-xs font-semibold text-slate-700 sm:text-sm">Account Details</span>
          <span className="sr-only">Complete</span>
        </li>
        <li aria-current="step" className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F3D5C] text-sm font-bold text-white">
            2
          </span>
          <span className="text-xs font-semibold text-[#0F3D5C] sm:text-sm">KK Profiling</span>
          <span className="sr-only">Current step</span>
        </li>
        <li className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-sm font-semibold text-slate-400">
            3
          </span>
          <span className="text-xs font-semibold text-slate-500 sm:text-sm">
            SKEAP Application (Optional)
          </span>
          <span className="sr-only">Optional upcoming step</span>
        </li>
      </ol>

      <section
        id="kk-profiling-form"
        className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
      >
        <KKProfilingForm />
      </section>
    </main>
  );
}
