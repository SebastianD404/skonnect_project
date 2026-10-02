const metricCards = Array.from({ length: 4 }, (_, index) => index);
const tableRows = Array.from({ length: 5 }, (_, index) => index);

export default function AdminMembersLoading() {
  return (
    <div role="status" aria-label="Loading members" className="animate-pulse flex w-full flex-col text-slate-950">
      <header>
        <div>
          <div className="mb-2 h-3 w-28 rounded bg-slate-200" />
          <div className="mb-1 h-7 w-48 rounded bg-slate-300" />
          <div className="h-4 w-96 max-w-full rounded bg-slate-200" />
        </div>
      </header>

      <section aria-hidden="true" className="my-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card) => (
          <div key={card} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="h-8 w-8 rounded-full bg-slate-200" />
            </div>
            <div className="mt-3 h-8 w-16 rounded bg-slate-300" />
            <div className="mt-1 h-3 w-24 rounded bg-slate-200" />
          </div>
        ))}
      </section>

      <section aria-hidden="true" className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="h-10 w-72 max-w-full rounded-lg bg-slate-200" />
          <div className="h-10 w-32 shrink-0 rounded-lg bg-slate-200" />
        </div>

        <div className="mb-2 flex h-12 w-full items-center gap-4 rounded-t-xl bg-slate-900 px-5">
          {[0, 1, 2, 3, 4].map((column) => (
            <div key={column} className={`h-3 rounded bg-slate-600 ${column === 0 ? "w-40" : "w-24"}`} />
          ))}
        </div>

        {tableRows.map((row) => (
          <div key={row} className="mb-2 flex h-14 w-full items-center gap-4 rounded-md bg-slate-100 px-5">
            {[0, 1, 2, 3, 4].map((column) => (
              <div key={column} className={`h-4 rounded bg-slate-200 ${column === 0 ? "w-40" : "w-24"}`} />
            ))}
          </div>
        ))}

        <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row">
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
