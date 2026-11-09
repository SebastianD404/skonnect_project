const tabs = Array.from({ length: 4 }, (_, index) => index);
const applicationCards = Array.from({ length: 4 }, (_, index) => index);
const tableRows = Array.from({ length: 5 }, (_, index) => index);

export default function AdminKKProfilingLoading() {
  return (
    <div
      role="status"
      aria-label="Loading KK profiling registrations"
      className="flex flex-col gap-6 sm:gap-8 w-full animate-pulse pb-12 text-slate-950"
    >
      <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 h-3 w-24 rounded bg-slate-200" />
          <div className="mb-1 h-7 w-64 max-w-full rounded bg-slate-300" />
          <div className="h-4 w-80 max-w-full rounded bg-slate-200" />
        </div>
        <div className="h-10 w-32 shrink-0 rounded-lg bg-slate-200" />
      </header>

      <section className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center">
          <div className="h-10 w-72 max-w-full rounded-lg bg-slate-200" />
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((tab) => (
              <div key={tab} className="h-9 w-24 rounded-full bg-slate-200" />
            ))}
          </div>
        </div>

          <div className="flex flex-col gap-3 p-4 md:hidden">
            {applicationCards.map((card) => (
              <article key={card} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-36 max-w-full rounded bg-slate-200" />
                    <div className="h-3 w-48 max-w-full rounded bg-slate-100" />
                  </div>
                  <div className="h-6 w-20 shrink-0 rounded-full bg-slate-200" />
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  {[0, 1].map((field) => (
                    <div key={field} className="space-y-2">
                      <div className="h-2.5 w-16 rounded bg-slate-200" />
                      <div className="h-3 w-24 max-w-full rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <div className="h-3 w-28 rounded bg-slate-100" />
                  <div className="h-9 w-20 rounded-lg bg-slate-200" />
                </div>
              </article>
            ))}
          </div>

          <div className="hidden w-full overflow-x-auto px-5 pt-4 md:block">
            <div className="mb-2 flex h-12 min-w-[850px] items-center gap-4 rounded-t-xl bg-slate-900 px-5">
              {[0, 1, 2, 3, 4, 5, 6].map((column) => (
                <div key={column} className={`h-3 shrink-0 rounded bg-slate-600 ${column === 0 ? "w-36" : "w-24"}`} />
              ))}
            </div>
            {tableRows.map((row) => (
              <div key={row} className="mb-2 flex h-16 min-w-[850px] items-center gap-4 rounded-md border border-slate-100 bg-slate-50/50 px-5">
                {[0, 1, 2, 3, 4, 5, 6].map((column) => (
                  <div key={column} className={`h-4 shrink-0 rounded bg-slate-200 ${column === 0 ? "w-36" : column === 6 ? "w-20" : "w-24"}`} />
                ))}
              </div>
            ))}
          </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 sm:flex-row">
          <div className="h-3 w-32 rounded bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 rounded-full bg-slate-200" />
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="h-8 w-20 rounded-full bg-slate-200" />
          </div>
        </div>
      </section>
      <span className="sr-only">Loading profiling registration data…</span>
    </div>
  );
}
