const metricCards = Array.from({ length: 4 }, (_, index) => index);
const tableRows = Array.from({ length: 5 }, (_, index) => index);

export default function AdminMembersLoading() {
  return (
    <div role="status" aria-label="Loading members" className="w-full max-w-[1200px] mx-auto flex flex-col gap-6 sm:gap-8 animate-pulse text-slate-950">
      <header>
        <div>
          <div className="mb-2 h-3 w-28 rounded bg-slate-200" />
          <div className="mb-1 h-7 w-48 rounded bg-slate-300" />
          <div className="h-4 w-96 max-w-full rounded bg-slate-200" />
        </div>
      </header>

      <section aria-hidden="true" className="grid w-full grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-4">
        {metricCards.map((card) => (
          <div key={card} className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm sm:p-5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="h-7 w-7 rounded-full bg-slate-200 sm:h-10 sm:w-10" />
            </div>
            <div className="mt-3 h-6 w-16 rounded bg-slate-300 sm:h-8" />
            <div className="mt-1 h-3 w-24 rounded bg-slate-200" />
          </div>
        ))}
      </section>

      <section aria-hidden="true" className="w-full animate-pulse overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="h-9 w-full rounded-full bg-slate-200 sm:w-80" />
          <div className="h-9 w-full rounded-xl bg-slate-200 sm:w-40" />
          <div className="h-9 w-full rounded-xl bg-slate-200 sm:ml-auto sm:w-32" />
        </div>

        <div className="flex flex-col gap-3 p-3 md:hidden">
          {tableRows.map((row) => (
            <article key={row} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-36 max-w-full rounded bg-slate-200" />
                    <div className="h-3 w-44 max-w-full rounded bg-slate-100" />
                  </div>
                </div>
                <div className="h-6 w-20 shrink-0 rounded-full bg-emerald-50" />
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                {[0, 1, 2, 3].map((field) => (
                  <div key={field} className="space-y-2">
                    <div className="h-2.5 w-16 rounded bg-slate-200" />
                    <div className="h-3 w-24 max-w-full rounded bg-slate-200" />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <div className="h-3 w-28 rounded bg-slate-100" />
                <div className="flex gap-2">
                  <div className="h-9 w-20 rounded-lg bg-slate-200" />
                  <div className="h-9 w-9 rounded-lg bg-slate-200" />
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="hidden w-full overflow-x-auto px-5 pt-4 md:block">
          <div className="mb-2 flex h-12 min-w-[850px] items-center gap-4 rounded-t-xl bg-slate-900 px-5">
            {[0, 1, 2, 3, 4, 5].map((column) => (
              <div key={column} className={`h-3 shrink-0 rounded bg-slate-600 ${column === 0 ? "w-40" : "w-24"}`} />
            ))}
          </div>
          {tableRows.map((row) => (
            <div key={row} className="mb-2 flex h-16 min-w-[850px] items-center gap-4 rounded-md bg-slate-100 px-5">
              {[0, 1, 2, 3, 4, 5].map((column) => (
                <div key={column} className={`h-4 shrink-0 rounded bg-slate-200 ${column === 0 ? "w-40" : "w-24"}`} />
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 sm:flex-row">
          <div className="h-3 w-28 rounded bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 rounded-lg bg-slate-200" />
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="h-8 w-16 rounded-lg bg-slate-200" />
          </div>
        </div>
      </section>
      <span className="sr-only">Loading member records…</span>
    </div>
  );
}
