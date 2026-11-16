import { AdminStatGridSkeleton, SkeletonBar } from "../components/AdminSkeletonPrimitives";

const inquiryRows = [0, 1, 2, 3, 4];

export default function InquiriesPageSkeleton() {
  return (
    <main role="status" aria-label="Loading inquiries" className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12">
      <header className="space-y-2">
        <SkeletonBar width="w-24" height="h-3" className="rounded-full bg-cyan-900/10" />
        <SkeletonBar width="w-48" height="h-8" />
        <SkeletonBar width="w-80" height="h-4" className="max-w-full bg-slate-100" />
      </header>

      <AdminStatGridSkeleton />

      <section aria-hidden="true" className="flex h-[min(720px,calc(100vh-390px))] min-h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <aside className="flex w-full shrink-0 flex-col bg-slate-50/50 md:w-[350px] md:border-r md:border-slate-200">
          <div className="space-y-3 border-b border-slate-200 bg-white p-4">
            <SkeletonBar width="w-full" height="h-9" className="rounded-lg bg-slate-100" />
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {[0, 1, 2].map((filter) => (
                <SkeletonBar key={filter} width="w-full" height="h-7" className="rounded-md bg-white/70" />
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-hidden">
            {inquiryRows.map((row) => (
              <article key={row} className="space-y-2.5 border-l-4 border-transparent p-4">
                <div className="flex items-center justify-between gap-2">
                  <SkeletonBar width="w-32" height="h-3" />
                  <SkeletonBar width="w-12" height="h-2.5" className="bg-slate-100" />
                </div>
                <SkeletonBar width={row % 2 ? "w-40" : "w-52"} height="h-3" className="max-w-full" />
                <SkeletonBar width="w-16" height="h-5" className="rounded-full bg-amber-50" />
              </article>
            ))}
          </div>
        </aside>
        <section className="hidden min-w-0 flex-1 flex-col bg-white md:flex">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBar width="w-64" height="h-5" className="max-w-full" />
              <SkeletonBar width="w-80" height="h-3" className="max-w-full bg-slate-100" />
              <SkeletonBar width="w-36" height="h-2.5" className="bg-slate-100" />
            </div>
            <SkeletonBar width="w-32" height="h-8" className="shrink-0 rounded-xl" />
          </header>
          <div className="min-h-0 flex-1 space-y-5 overflow-hidden bg-slate-50/30 p-4 sm:p-6">
            <div className="flex flex-col items-start gap-2">
              <SkeletonBar width="w-40" height="h-3" className="bg-slate-100" />
              <SkeletonBar width="w-3/5" height="h-20" className="rounded-2xl" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <SkeletonBar width="w-32" height="h-3" className="bg-slate-100" />
              <SkeletonBar width="w-2/5" height="h-16" className="rounded-2xl bg-slate-300/70" />
            </div>
          </div>
          <footer className="border-t border-slate-200 bg-white p-4">
            <SkeletonBar width="w-full" height="h-20" className="rounded-xl bg-slate-100" />
            <SkeletonBar width="w-28" height="h-9" className="ml-auto mt-3 rounded-xl" />
          </footer>
        </section>
      </section>
      <span className="sr-only">Loading inquiry inbox…</span>
    </main>
  );
}
