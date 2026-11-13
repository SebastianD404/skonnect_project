const metricCards = Array.from({ length: 4 }, (_, index) => index);

export default function AdminDashboardSkeleton() {
  return (
    <main className="flex w-full flex-col gap-6 sm:gap-8 animate-pulse pb-12">
      <header>
        <div className="px-8">
          <div className="h-3 w-40 rounded bg-slate-200" />
          <div className="mt-3 h-12 w-4/5 max-w-full rounded bg-slate-200" />
        </div>
      </header>

      <section
        aria-label="Dashboard metrics"
        className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4 w-full"
      >
        {metricCards.map((card) => (
          <div
            key={card}
            className="flex min-h-[120px] flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm sm:min-h-[140px] sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="h-3 w-28 rounded bg-slate-200" />
              <div className="h-7 w-7 rounded-full bg-cyan-50 sm:h-10 sm:w-10" />
            </div>
            <div>
              <div className="h-6 w-16 rounded bg-slate-200 sm:h-8" />
              <div className="mt-2 h-3 w-24 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </section>

      <section aria-label="Demographics" className="px-4 sm:px-8">
        <div className="flex items-center gap-4 py-2">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="h-px flex-1 rounded-full bg-slate-200/60" />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="min-h-[320px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="h-5 w-44 max-w-full rounded bg-slate-200" />
                <div className="mt-2 h-3 w-48 max-w-full rounded bg-slate-100" />
              </div>
              <div className="h-8 w-8 shrink-0 rounded-full bg-slate-100" />
            </div>
            <div className="mt-3 flex h-[190px] animate-pulse items-center justify-center">
              <div className="relative h-36 w-36 rounded-full bg-slate-200">
                <div className="absolute inset-5 flex flex-col items-center justify-center gap-1 rounded-full bg-white">
                  <div className="h-5 w-10 rounded bg-slate-100" />
                  <div className="h-2 w-8 rounded bg-slate-100" />
                </div>
              </div>
            </div>
            <div className="mt-2 flex justify-center gap-4">
              <div className="h-3 w-14 rounded bg-slate-100" />
              <div className="h-3 w-16 rounded bg-slate-100" />
              <div className="h-3 w-20 rounded bg-slate-100" />
            </div>
          </div>
          <div className="min-h-[320px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="h-5 w-40 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
              </div>
              <div className="h-8 w-8 shrink-0 rounded-full bg-slate-100" />
            </div>
            <div className="mt-5 flex h-[220px] animate-pulse items-end justify-around rounded-xl bg-slate-50 p-5">
              <div className="h-2/5 w-8 rounded-t bg-slate-200" />
              <div className="h-3/5 w-8 rounded-t bg-slate-200" />
              <div className="h-4/5 w-8 rounded-t bg-slate-200" />
              <div className="h-1/2 w-8 rounded-t bg-slate-200" />
            </div>
          </div>
          <div className="min-h-[320px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="h-5 w-36 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-48 max-w-full rounded bg-slate-100" />
              </div>
              <div className="h-8 w-8 shrink-0 rounded-full bg-slate-100" />
            </div>
            <div className="mt-4">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2 w-2 rounded-full bg-slate-200" />
                    <div className="h-4 w-36 max-w-[70%] rounded bg-slate-200" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-8 rounded bg-slate-200" />
                    <div className="h-3 w-7 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <span className="sr-only">Loading admin dashboard…</span>
    </main>
  );
}
