import { SkeletonBar } from "../components/AdminSkeletonPrimitives";

const applicantCards = [0, 1, 2, 3];
const profileFields = [0, 1, 2, 3, 4, 5, 6, 7];

export default function SkeapApplicationsSkeleton() {
  return (
    <main role="status" aria-label="Loading SKEAP applications" className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 pb-20 text-slate-900">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <SkeletonBar width="w-36" height="h-3" className="rounded-full bg-cyan-900/10" />
          <SkeletonBar width="w-72" height="h-8" className="max-w-full" />
          <SkeletonBar width="w-[32rem]" height="h-4" className="max-w-full bg-slate-100" />
        </div>
      </header>

      <section aria-label="Application status metrics" className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {applicantCards.map((card) => (
          <div key={card} className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm sm:gap-3 sm:p-5">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <SkeletonBar width="w-28" height="h-3" className="max-w-[75%] rounded-full" />
              <SkeletonBar width="w-7 sm:w-10" height="h-7 sm:h-10" className="shrink-0 rounded-full bg-cyan-50" />
            </div>
            <SkeletonBar width="w-12" height="h-6 sm:h-8" />
            <SkeletonBar width="w-24" height="h-3" className="bg-slate-100" />
          </div>
        ))}
      </section>

      <section className="flex min-h-[600px] w-full flex-col items-stretch overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm lg:h-[calc(100vh-200px)] lg:flex-row">
        <aside className="flex min-h-[500px] w-full shrink-0 flex-col overflow-hidden border-b border-slate-200 bg-slate-50 lg:min-h-0 lg:h-full lg:w-96 lg:border-b-0 lg:border-r">
          <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 p-5">
            <div className="space-y-3">
              <SkeletonBar width="w-32" height="h-3" />
              <SkeletonBar width="w-40" height="h-7" />
            </div>
            <div className="flex items-center gap-2">
              <SkeletonBar width="w-full" height="h-9" className="rounded-lg bg-white" />
              <SkeletonBar width="w-9" height="h-9" className="shrink-0 rounded-lg bg-white" />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-hidden p-4">
            {applicantCards.map((applicant) => (
              <article key={applicant} className="rounded-xl border border-slate-100 bg-white p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <SkeletonBar width={applicant % 2 ? "w-36" : "w-40"} height="h-4" className="max-w-full" />
                    <SkeletonBar width="w-32" height="h-3" className="max-w-full bg-slate-100" />
                  </div>
                  <SkeletonBar width="w-20" height="h-6" className="shrink-0 rounded-full bg-slate-100" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <SkeletonBar width="w-24" height="h-3" className="bg-slate-100" />
                  <SkeletonBar width="w-12" height="h-3" className="bg-slate-100" />
                </div>
              </article>
            ))}
          </div>
          <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-4">
            <SkeletonBar width="w-24" height="h-3" />
            <div className="flex gap-2">
              <SkeletonBar width="w-8" height="h-8" className="rounded-lg" />
              <SkeletonBar width="w-8" height="h-8" className="rounded-lg" />
            </div>
          </div>
        </aside>

        <div className="flex min-h-[600px] min-w-0 flex-1 flex-col bg-slate-50/50 lg:h-full lg:min-h-0">
          <div className="shrink-0 border-b border-slate-200 bg-white px-5 pt-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <SkeletonBar width="w-36" height="h-3" />
                <SkeletonBar width="w-56" height="h-7" className="max-w-full" />
                <SkeletonBar width="w-48" height="h-4" className="max-w-full bg-slate-100" />
              </div>
              <SkeletonBar width="w-28" height="h-9" className="rounded-lg" />
            </div>
            <div className="mt-4 flex gap-6 border-b border-slate-100">
              <SkeletonBar width="w-16" height="h-8" className="rounded-t border-b-2 border-slate-300 bg-slate-100" />
              <SkeletonBar width="w-32" height="h-8" className="rounded-t bg-slate-100" />
              <SkeletonBar width="w-24" height="h-8" className="rounded-t bg-slate-100" />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-hidden p-5">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <SkeletonBar width="w-32" height="h-4" />
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-100 md:grid-cols-4">
                {profileFields.map((field) => (
                  <div key={field} className="space-y-2 bg-white p-4 md:p-5">
                    <SkeletonBar width="w-20" height="h-3" className="bg-slate-100" />
                    <SkeletonBar width="w-28" height="h-4" className="max-w-full" />
                  </div>
                ))}
              </div>
            </section>
            <div className="grid gap-3 sm:grid-cols-2">
              <SkeletonBar width="w-full" height="h-12" className="rounded-3xl" />
              <SkeletonBar width="w-full" height="h-12" className="rounded-lg bg-slate-100" />
            </div>
          </div>
        </div>
      </section>
      <span className="sr-only">Loading SKEAP application records…</span>
    </main>
  );
}
