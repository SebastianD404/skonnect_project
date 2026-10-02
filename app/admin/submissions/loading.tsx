const submissionRows = Array.from({ length: 5 }, (_, index) => index);
const submissionColumns = Array.from({ length: 6 }, (_, index) => index);

export default function AdminSubmissionsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading grantee submissions"
      className="animate-pulse mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12"
    >
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 h-3 w-24 rounded bg-slate-200" />
          <div className="mb-1 h-7 w-56 max-w-full rounded bg-slate-300" />
          <div className="h-4 w-80 max-w-full rounded bg-slate-200" />
        </div>
        <div className="h-10 w-32 shrink-0 rounded-lg bg-slate-200" />
      </header>

      <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="h-10 w-72 max-w-full rounded-lg bg-slate-200" />
          <div className="h-10 w-44 shrink-0 rounded-lg bg-slate-200" />
        </div>

        <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
          <div className="h-3 w-40 rounded bg-slate-200" />
        </div>

        <div className="w-full overflow-x-auto">
          <div className="mb-2 flex h-12 w-full items-center gap-4 rounded-t-xl bg-slate-900 px-6">
            {submissionColumns.map((column) => (
              <div
                key={column}
                className={`h-3 rounded bg-slate-600 ${column === 0 ? "w-36" : "w-24"}`}
              />
            ))}
          </div>

          {submissionRows.map((row) => (
            <div key={row} className="mb-2 flex h-16 w-full items-center gap-4 rounded-md bg-slate-100 px-6">
              {submissionColumns.map((column) => (
                <div
                  key={column}
                  className={`h-4 rounded bg-slate-200 ${column === 0 ? "w-36" : "w-24"}`}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:flex-row">
          <div className="h-4 w-28 rounded bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-20 rounded-lg bg-slate-200" />
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="h-9 w-20 rounded-lg bg-slate-200" />
          </div>
        </div>
      </section>
      <span className="sr-only">Loading grantee submission records…</span>
    </div>
  );
}
