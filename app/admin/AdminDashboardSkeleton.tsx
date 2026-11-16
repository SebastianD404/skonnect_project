import { SkeletonBar } from "./components/AdminSkeletonPrimitives";

const cards = [0, 1, 2, 3];
const chartWidths = ["w-1/3", "w-2/5", "w-1/2", "w-3/5", "w-2/3", "w-4/5"];

export default function AdminDashboardSkeleton() {
  return (
    <main role="status" aria-label="Loading admin dashboard" className="flex w-full flex-col gap-8 pb-12">
      <header className="px-8">
        <SkeletonBar width="w-44" height="h-3" className="rounded-full bg-cyan-900/10" />
        <SkeletonBar width="w-4/5" height="h-12" className="mt-2 max-w-full" />
      </header>

      <div className="flex flex-col gap-6 px-4 sm:px-8">
        <section aria-hidden="true" className="mt-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_180px] xl:items-center">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {cards.map((card) => (
                <article key={card} className="flex h-[132px] flex-col gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <SkeletonBar width="w-24" height="h-3" />
                    <SkeletonBar width="w-9" height="h-9" className="rounded-xl bg-cyan-50" />
                  </div>
                  <SkeletonBar width="w-20" height="h-8" className="mt-5" />
                  <SkeletonBar width="w-28" height="h-3" className="mt-2 bg-slate-100" />
                </article>
              ))}
            </div>
            <div className="hidden h-[132px] w-[180px] items-center justify-center xl:flex">
              <SkeletonBar width="w-28" height="h-28" className="rounded-full bg-cyan-50" />
            </div>
          </div>
        </section>

        <section aria-hidden="true" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="space-y-2">
              <SkeletonBar width="w-36" height="h-3" className="rounded-full" />
              <SkeletonBar width="w-64" height="h-6" />
              <SkeletonBar width="w-80" height="h-4" className="max-w-full bg-slate-100" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
                <SkeletonBar width="w-28" height="h-9" className="rounded-full bg-white/70" />
                <SkeletonBar width="w-24" height="h-9" className="rounded-full bg-slate-200/70" />
              </div>
              <SkeletonBar width="w-9" height="h-9" className="rounded-full bg-slate-100" />
            </div>
          </header>
          <div className="h-[370px] bg-white px-2 pb-5 sm:px-5">
            <div className="flex h-full flex-col justify-end gap-3 pb-3">
              {chartWidths.map((width, row) => (
                <div key={row} className="flex items-center gap-4">
                  <SkeletonBar width="w-28" height="h-3" className="shrink-0 bg-slate-100" />
                  <SkeletonBar width={width} height="h-5" className="rounded-r-md bg-cyan-100/70" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-label="Demographics" className="mt-2">
          <div className="flex items-center gap-4 py-2">
            <SkeletonBar width="w-24" height="h-3" className="rounded-full" />
            <div className="h-px flex-1 rounded-full bg-slate-200/60" />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {cards.slice(0, 3).map((card) => (
              <article key={card} className="min-h-[320px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <SkeletonBar width="w-44" height="h-5" />
                    <SkeletonBar width="w-48" height="h-3" className="bg-slate-100" />
                  </div>
                  <SkeletonBar width="w-8" height="h-8" className="rounded-full bg-slate-100" />
                </div>
                <SkeletonBar width="w-full" height="h-48" className="mt-5 rounded-xl bg-slate-50" />
              </article>
            ))}
          </div>
        </section>
      </div>
      <span className="sr-only">Loading dashboard analytics…</span>
    </main>
  );
}
