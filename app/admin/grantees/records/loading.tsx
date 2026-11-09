const archiveRows = Array.from({ length: 5 }, (_, index) => index);

export function GranteeRecordsLoading() {
  return (
    <main role="status" aria-label="Loading archived grantee records" className="flex w-full animate-pulse flex-col gap-6 pb-12">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <div className="h-3 w-28 rounded bg-slate-200" />
          <div className="mb-1.5 mt-2 h-8 w-64 max-w-full rounded bg-slate-300" />
          <div className="h-4 w-96 max-w-full rounded bg-slate-100" />
        </div>
        <div className="h-10 w-full rounded-xl bg-slate-200 sm:w-36" />
      </header>

      <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-9 w-full rounded-full bg-slate-100 sm:w-80" />
          <div className="flex w-fit items-center gap-1 rounded-xl bg-slate-100 p-1">
            {[0, 1, 2].map((tab) => <div key={tab} className="h-8 w-16 rounded-lg bg-white/70" />)}
          </div>
        </div>

        <div className="flex flex-col gap-3 p-3 md:hidden">
          {archiveRows.map((row) => (
            <article key={row} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-36 max-w-full rounded bg-slate-200" />
                  <div className="h-3 w-48 max-w-full rounded bg-slate-100" />
                </div>
                <div className="h-6 w-20 shrink-0 rounded-full bg-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="col-span-2 space-y-2">
                  <div className="h-2.5 w-20 rounded bg-slate-200" />
                  <div className="h-3 w-36 max-w-full rounded bg-slate-200" />
                  <div className="h-3 w-20 rounded bg-slate-100" />
                </div>
                {[0, 1, 2].map((field) => (
                  <div key={field} className={`space-y-2 ${field === 2 ? "col-span-2" : ""}`}>
                    <div className="h-2.5 w-16 rounded bg-slate-200" />
                    <div className="h-3 w-24 max-w-full rounded bg-slate-100" />
                  </div>
                ))}
              </div>
              <div className="flex justify-end border-t border-slate-100 pt-2">
                <div className="h-9 w-28 rounded-lg bg-slate-200" />
              </div>
            </article>
          ))}
        </div>

        <div className="hidden w-full overflow-x-auto p-4 md:block">
          <div className="mb-2 flex h-11 min-w-[900px] items-center gap-5 rounded-t-xl bg-slate-900 px-4">
            {[0, 1, 2, 3, 4, 5, 6].map((column) => (
              <div key={column} className={`h-3 shrink-0 rounded bg-slate-600 ${column === 0 ? "w-36" : "w-24"}`} />
            ))}
          </div>
          {archiveRows.map((row) => (
            <div key={row} className="mb-2 flex h-16 min-w-[900px] items-center gap-5 rounded-md bg-slate-50 px-4">
              {[0, 1, 2, 3, 4, 5, 6].map((column) => (
                <div key={column} className={`h-4 shrink-0 rounded bg-slate-200 ${column === 0 ? "w-36" : "w-24"}`} />
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3.5">
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start sm:gap-4">
            <div className="h-4 w-28 rounded bg-slate-200" />
            <div className="flex shrink-0 items-center gap-2">
              <div className="h-3 w-8 rounded bg-slate-100" />
              <div className="h-9 w-20 rounded-lg bg-white ring-1 ring-slate-200" />
            </div>
          </div>
          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:w-auto">
            <div className="h-9 rounded-lg bg-white ring-1 ring-slate-200 sm:w-20" />
            <div className="h-4 w-20 rounded bg-slate-100" />
            <div className="h-9 rounded-lg bg-white ring-1 ring-slate-200 sm:w-20" />
          </div>
        </div>
      </section>
      <span className="sr-only">Loading archived grantee records…</span>
    </main>
  );
}

export default GranteeRecordsLoading;
