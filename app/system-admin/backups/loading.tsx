function Placeholder({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}

export default function SystemAdminBackupsLoading() {
  return (
    <div role="status" aria-label="Loading data backup and recovery" className="flex w-full flex-col gap-6 sm:gap-8">
      <div className="mb-0 flex items-center gap-2">
        <Placeholder className="h-3 w-20" />
        <Placeholder className="h-3 w-2" />
        <Placeholder className="h-3 w-24" />
      </div>

      <header className="space-y-2">
        <Placeholder className="h-3 w-24" />
        <Placeholder className="h-12 w-80 max-w-full" />
        <Placeholder className="h-4 w-[min(38rem,100%)]" />
      </header>

      <section aria-hidden="true" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <Placeholder className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="space-y-2">
              <Placeholder className="h-5 w-52 max-w-full" />
              <Placeholder className="h-4 w-[min(38rem,100%)]" />
            </div>
          </div>
          <Placeholder className="h-7 w-36 rounded-full" />
        </div>
        <div className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-3 sm:p-6">
          {[0, 1, 2].map((metric) => (
            <div key={metric} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <Placeholder className="h-3 w-28" />
              <Placeholder className="h-4 w-36" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex flex-wrap gap-2">
            <Placeholder className="h-10 w-56 rounded-xl" />
            <Placeholder className="h-10 w-52 rounded-xl" />
          </div>
          <Placeholder className="h-8 w-full max-w-md" />
        </div>
        <div className="space-y-3 border-t border-slate-100 px-5 py-5 sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Placeholder className="h-4 w-44" />
            <Placeholder className="h-4 w-14" />
          </div>
          {[0, 1, 2].map((row) => (
            <div key={row} className="grid grid-cols-2 gap-4 border-t border-slate-100 py-3 sm:grid-cols-6">
              {[0, 1, 2, 3, 4, 5].map((column) => (
                <Placeholder key={column} className="h-4 w-full" />
              ))}
            </div>
          ))}
        </div>
      </section>
      <span className="sr-only">Loading backup history…</span>
    </div>
  );
}
