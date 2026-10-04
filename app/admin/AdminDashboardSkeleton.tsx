const metricCards = Array.from({ length: 4 }, (_, index) => index);
const actionCards = Array.from({ length: 2 }, (_, index) => index);
const inquiryRows = Array.from({ length: 3 }, (_, index) => index);

export default function AdminDashboardSkeleton() {
  return (
    <main className="mx-auto flex w-full animate-pulse max-w-7xl flex-col gap-6 pb-12">
      <header>
        <div className="px-8">
          <div className="h-3 w-40 rounded bg-slate-200" />
          <div className="mt-3 h-12 w-4/5 max-w-full rounded bg-slate-200" />
        </div>
      </header>

      <section
        aria-label="Dashboard metrics"
        className="grid grid-cols-1 gap-4 px-8 md:grid-cols-2 lg:grid-cols-4"
      >
        {metricCards.map((card) => (
          <div
            key={card}
            className="flex min-h-[140px] flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="h-3 w-28 rounded bg-slate-200" />
              <div className="h-8 w-8 rounded-full bg-cyan-50" />
            </div>
            <div>
              <div className="h-8 w-16 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-24 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </section>

      <div className="flex items-center gap-4 px-8 py-2">
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className="h-px flex-1 rounded-full bg-slate-200/60" />
      </div>

      <section
        aria-label="Dashboard action center"
        className="grid grid-cols-1 items-stretch gap-4 px-8 md:grid-cols-2"
      >
        {actionCards.map((card) => (
          <div
            key={card}
            className="relative flex min-h-[320px] flex-col overflow-hidden rounded-3xl border border-slate-200/70 border-t-2 border-t-cyan-500/20 bg-white shadow-sm"
          >
            <header className="flex items-center justify-between border-b border-slate-100/80 px-6 py-5">
              <div className="space-y-2">
                <div className="h-3 w-28 rounded bg-slate-100" />
                <div className="h-6 w-36 rounded bg-slate-200" />
              </div>
              <div className="h-8 w-8 rounded-full bg-emerald-50" />
            </header>

            <div className="flex flex-1 flex-col items-center justify-center p-8">
              <div className={`mb-4 h-16 w-16 rounded-full ${card === 0 ? "bg-cyan-50" : "bg-emerald-50"}`} />
              {card === 0 ? (
                <div className="w-full space-y-4">
                  {inquiryRows.map((row) => (
                    <div key={row} className="border-b border-slate-100 pb-3 last:border-0">
                      <div className="h-4 w-2/3 rounded bg-slate-200" />
                      <div className="mt-2 h-3 w-4/5 rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="mb-2 h-4 w-44 max-w-full rounded bg-slate-200" />
                  <div className="h-3 w-56 max-w-full rounded bg-slate-100" />
                  <div className="mt-6 h-9 w-48 rounded-xl bg-slate-100" />
                </>
              )}
            </div>
          </div>
        ))}
      </section>
      <span className="sr-only">Loading admin dashboard…</span>
    </main>
  );
}
