const applicationRows = Array.from({ length: 5 }, (_, index) => index);
const statusTabs = Array.from({ length: 4 }, (_, index) => index);
const tableColumns = Array.from({ length: 5 }, (_, index) => index);

export default function SkeapApplicationsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading SKEAP applications"
      className="animate-pulse min-h-screen bg-slate-50 text-slate-900"
    >
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 pb-12">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 h-3 w-32 rounded bg-slate-200" />
            <div className="mb-1 h-7 w-52 max-w-full rounded bg-slate-300" />
            <div className="h-4 w-96 max-w-full rounded bg-slate-200" />
          </div>
          <div className="h-10 w-32 shrink-0 rounded-lg bg-slate-200" />
        </header>

        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="h-10 w-72 max-w-full rounded-lg bg-slate-200" />
            <div className="flex flex-wrap items-center gap-2">
              {statusTabs.map((tab) => (
                <div key={tab} className="h-9 w-24 rounded-full bg-slate-200" />
              ))}
            </div>
          </div>

          <div className="w-full overflow-x-auto p-5">
            <div className="mb-2 flex h-12 w-full items-center gap-5 rounded-t-xl bg-slate-900 px-6">
              {tableColumns.map((column) => (
                <div
                  key={column}
                  className={`h-3 rounded bg-slate-600 ${column === 0 ? "w-40" : "w-28"}`}
                />
              ))}
            </div>

            {applicationRows.map((row) => (
              <div key={row} className="mb-2 flex h-16 w-full items-center gap-5 rounded-md bg-slate-100 px-6">
                <div className="flex min-w-40 flex-1 items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
                  <div className="space-y-2">
                    <div className="h-3 w-32 rounded bg-slate-200" />
                    <div className="h-3 w-24 rounded bg-slate-200" />
                  </div>
                </div>
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="h-4 w-28 rounded bg-slate-200" />
                <div className="h-6 w-20 rounded-full bg-slate-200" />
                <div className="h-9 w-20 rounded-lg bg-slate-200" />
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:flex-row">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="h-9 w-20 rounded-lg bg-slate-200" />
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="h-9 w-20 rounded-lg bg-slate-200" />
            </div>
          </div>
        </section>
        <span className="sr-only">Loading SKEAP application records…</span>
      </main>
    </div>
  );
}
