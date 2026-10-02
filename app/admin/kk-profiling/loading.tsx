const tabs = Array.from({ length: 4 }, (_, index) => index);

export default function AdminKKProfilingLoading() {
  return (
    <div
      role="status"
      aria-label="Loading KK profiling registrations"
      className="animate-pulse mx-auto flex w-full max-w-7xl flex-col pb-12 text-slate-950"
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

        <div className="w-full overflow-x-auto px-5 pt-4">
          <div className="mb-4 flex h-12 w-full items-center gap-4 rounded-t-xl bg-slate-900 px-5">
            {[0, 1, 2, 3, 4, 5, 6].map((column) => (
              <div
                key={column}
                className={`h-3 rounded bg-slate-600 ${column === 0 ? "w-36" : "w-24"}`}
              />
            ))}
          </div>
          <div className="mb-4 flex h-48 w-full items-center justify-center rounded-xl border border-slate-100 bg-white">
            <div className="h-4 w-48 rounded bg-slate-200" />
          </div>
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
