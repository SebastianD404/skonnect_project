const granteeRows = Array.from({ length: 5 }, (_, index) => index);
const tableColumns = Array.from({ length: 6 }, (_, index) => index);
const statusFilters = Array.from({ length: 4 }, (_, index) => index);

export default function AdminGranteesLoading() {
  return (
    <div
      role="status"
      aria-label="Loading grantees"
      className="animate-pulse flex w-full flex-col gap-6 pb-12"
    >
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 h-3 w-28 rounded bg-slate-200" />
          <div className="mb-1 h-7 w-64 max-w-full rounded bg-slate-300" />
          <div className="h-4 w-96 max-w-full rounded bg-slate-200" />
        </div>
        <div className="h-10 w-32 shrink-0 rounded-lg bg-slate-200" />
      </header>

      <section className="mt-4 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-100 bg-white p-4 sm:flex-row sm:p-5">
          <div className="h-10 w-72 max-w-full rounded-lg bg-slate-200" />
          <div className="flex gap-2">
            {statusFilters.map((filter) => (
              <div key={filter} className="h-9 w-20 rounded-full bg-slate-200" />
            ))}
          </div>
        </div>

        <div className="w-full overflow-x-auto p-4">
          <div className="mb-2 flex h-12 w-full items-center gap-5 rounded-t-xl bg-slate-900 px-4">
            {tableColumns.map((column) => (
              <div
                key={column}
                className={`h-3 rounded bg-slate-600 ${column === 0 ? "w-36" : "w-24"}`}
              />
            ))}
          </div>

          {granteeRows.map((row) => (
            <div
              key={row}
              className="mb-2 flex h-16 w-full items-center gap-5 rounded-md border border-slate-100 bg-slate-50/50 px-4"
            >
              <div className="flex min-w-0 flex-[2] items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
                <div className="min-w-0 space-y-2">
                  <div className="h-4 w-32 max-w-full rounded bg-slate-200" />
                  <div className="h-3 w-40 max-w-full rounded bg-slate-200" />
                </div>
              </div>
              <div className="min-w-0 flex-[1.5] space-y-2">
                <div className="h-4 w-32 max-w-full rounded bg-slate-200" />
                <div className="h-3 w-24 max-w-full rounded bg-slate-200" />
              </div>
              <div className="flex-1">
                <div className="h-6 w-24 rounded-full bg-slate-200" />
              </div>
              <div className="h-4 w-16 rounded bg-slate-200" />
              <div className="h-4 w-20 rounded bg-slate-200" />
              <div className="flex flex-1 justify-center">
                <div className="h-9 w-20 rounded-lg bg-slate-200" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 sm:flex-row">
          <div className="h-4 w-36 rounded bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 rounded-lg bg-slate-200" />
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="h-8 w-16 rounded-lg bg-slate-200" />
          </div>
        </div>
      </section>
      <span className="sr-only">Loading grantee status records…</span>
    </div>
  );
}
