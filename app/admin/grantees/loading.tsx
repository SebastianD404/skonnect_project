const granteeRows = Array.from({ length: 5 }, (_, index) => index);
const tableColumns = Array.from({ length: 6 }, (_, index) => index);

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
        <div className="flex gap-2">
          <div className="h-10 w-32 shrink-0 rounded-lg bg-slate-200" />
          <div className="h-10 w-32 shrink-0 rounded-lg bg-slate-200" />
        </div>
      </header>

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-100 bg-white p-4 sm:flex-row sm:p-5">
          <div className="h-10 w-72 max-w-full rounded-lg bg-slate-200" />
        </div>

        <div className="flex flex-col gap-3 p-3 md:hidden">
          {granteeRows.map((row) => (
            <article key={row} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
                  <div className="min-w-0 space-y-2">
                    <div className="h-4 w-32 max-w-full rounded bg-slate-200" />
                    <div className="h-3 w-40 max-w-full rounded bg-slate-100" />
                  </div>
                </div>
                <div className="h-6 w-20 shrink-0 rounded-full bg-emerald-50" />
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="col-span-2 space-y-2">
                  <div className="h-2.5 w-20 rounded bg-slate-200" />
                  <div className="h-3 w-36 max-w-full rounded bg-slate-200" />
                  <div className="h-3 w-20 rounded bg-slate-100" />
                </div>
                {[0, 1].map((field) => (
                  <div key={field} className="space-y-2">
                    <div className="h-2.5 w-16 rounded bg-slate-200" />
                    <div className="h-4 w-20 rounded bg-slate-200" />
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

        <div className="hidden w-full overflow-x-auto p-4 md:block">
          <div className="mb-2 flex h-12 min-w-[760px] items-center gap-5 rounded-t-xl bg-slate-900 px-4">
            {tableColumns.map((column) => (
              <div key={column} className={`h-3 shrink-0 rounded bg-slate-600 ${column === 0 ? "w-36" : "w-24"}`} />
            ))}
          </div>

          {granteeRows.map((row) => (
            <div
              key={row}
              className="mb-2 flex h-16 min-w-[760px] items-center gap-5 rounded-md border border-slate-100 bg-slate-50/50 px-4"
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
