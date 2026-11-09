const rows = Array.from({ length: 5 }, (_, index) => index);

function Placeholder({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

export function MemberRecordsLoading() {
  return (
    <main role="status" aria-label="Loading archived member records" className="mx-auto flex w-full max-w-7xl animate-pulse flex-col gap-6 pb-12 sm:gap-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Placeholder className="h-3 w-28 bg-slate-100" />
          <Placeholder className="mb-1.5 mt-2 h-8 w-64 max-w-full" />
          <Placeholder className="h-4 w-[34rem] max-w-full bg-slate-100" />
        </div>
      </header>

      <section className="flex w-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Placeholder className="h-9 w-full rounded-full bg-white ring-1 ring-slate-200 sm:w-80" />
          <Placeholder className="h-9 w-full rounded-xl bg-slate-800 sm:w-32" />
        </div>

        <div className="flex flex-col gap-3 p-3 md:hidden">
          {rows.map((row) => (
            <article key={row} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Placeholder className="h-4 w-36 max-w-full" />
                  <Placeholder className="h-3 w-48 max-w-full bg-slate-100" />
                </div>
                <Placeholder className="h-6 w-20 shrink-0 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-y border-slate-100 py-3">
                {[0, 1, 2, 3].map((field) => (
                  <div key={field} className="space-y-2">
                    <Placeholder className="h-2.5 w-16 bg-slate-100" />
                    <Placeholder className="h-3 w-24 max-w-full" />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <Placeholder className="h-3 w-28 bg-slate-100" />
                <div className="flex gap-2">
                  <Placeholder className="h-8 w-8 rounded-lg" />
                  <Placeholder className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="hidden w-full overflow-x-auto whitespace-nowrap p-4 md:block">
          <div className="mb-2 flex h-11 min-w-[900px] items-center gap-5 rounded-t-xl bg-slate-900 px-4">
            {[0, 1, 2, 3, 4, 5, 6].map((column) => (
              <Placeholder key={column} className={`h-3 shrink-0 bg-slate-600 ${column === 0 ? "w-36" : "w-24"}`} />
            ))}
          </div>
          {rows.map((row) => (
            <div key={row} className="mb-2 flex h-16 min-w-[900px] items-center gap-5 rounded-md bg-slate-50 px-4">
              {[0, 1, 2, 3, 4, 5, 6].map((column) => (
                <Placeholder key={column} className={`h-4 shrink-0 ${column === 0 ? "w-36" : "w-24"}`} />
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start sm:gap-4">
            <Placeholder className="h-4 w-32 bg-slate-100" />
            <div className="flex shrink-0 items-center gap-2">
              <Placeholder className="h-3 w-8 bg-slate-100" />
              <Placeholder className="h-9 w-20 rounded-lg bg-white ring-1 ring-slate-200" />
            </div>
          </div>
          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:w-auto">
            <Placeholder className="h-9 rounded-lg bg-white ring-1 ring-slate-200 sm:w-20" />
            <Placeholder className="h-4 w-20 bg-slate-100" />
            <Placeholder className="h-9 rounded-lg bg-white ring-1 ring-slate-200 sm:w-20" />
          </div>
        </div>
      </section>
      <span className="sr-only">Loading archived member records…</span>
    </main>
  );
}

export default MemberRecordsLoading;
