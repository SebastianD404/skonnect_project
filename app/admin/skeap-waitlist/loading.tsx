const waitlistRows = Array.from({ length: 5 }, (_, index) => index);
const waitlistColumns = Array.from({ length: 5 }, (_, index) => index);
const filterPills = Array.from({ length: 3 }, (_, index) => index);

export default function SkeapWaitlistLoading() {
  return (
    <main
      role="status"
      aria-label="Loading SKEAP waitlist"
      className="animate-pulse mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12"
    >
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="max-w-2xl">
          <div className="mb-2 h-3 w-28 rounded bg-slate-200" />
          <div className="mb-1 h-7 w-48 rounded bg-slate-300" />
          <div className="h-4 w-72 max-w-full rounded bg-slate-200" />
        </div>
        <div className="h-10 w-32 shrink-0 rounded-lg bg-slate-200" />
      </header>

      <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center">
          <div className="h-10 w-72 max-w-full rounded-lg bg-slate-200" />
          <div className="flex items-center gap-2">
            {filterPills.map((pill) => (
              <div key={pill} className="h-9 w-24 rounded-full bg-slate-200" />
            ))}
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <div className="mb-2 flex h-12 w-full items-center gap-4 rounded-t-xl bg-slate-900 px-6">
            {waitlistColumns.map((column) => (
              <div
                key={column}
                className={`h-3 rounded bg-slate-600 ${column === 0 ? "w-36" : "w-28"}`}
              />
            ))}
          </div>

          {waitlistRows.map((row) => (
            <div key={row} className="mb-2 flex h-14 w-full items-center gap-4 rounded-md bg-slate-100 px-6">
              {waitlistColumns.map((column) => (
                <div
                  key={column}
                  className={`h-4 rounded bg-slate-200 ${column === 0 ? "w-36" : "w-28"}`}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 sm:flex-row">
          <div className="h-3 w-32 rounded bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-20 rounded-lg bg-slate-200" />
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="h-9 w-20 rounded-lg bg-slate-200" />
          </div>
        </div>
      </section>
      <span className="sr-only">Loading waitlist records…</span>
    </main>
  );
}
