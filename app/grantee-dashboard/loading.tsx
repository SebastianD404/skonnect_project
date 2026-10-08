export default function GranteeDashboardLoading() {
  return (
    <main
      className="grantee-dashboard-skeleton-reveal min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 px-6 py-10 text-slate-900 lg:px-10 lg:py-14"
      role="status"
      aria-label="Loading grantee dashboard"
      aria-busy="true"
    >
      <div className="grantee-dashboard-skeleton-pulse mx-auto max-w-7xl space-y-8">
        <section className="grid grid-cols-1 gap-8 overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_60px_-30px_rgba(15,23,42,0.18)] lg:grid-cols-[1.4fr_1fr] lg:gap-12 lg:p-12">
          <div className="flex flex-col justify-center">
            <div className="h-7 w-56 rounded-full bg-slate-100" />
            <div className="mt-5 space-y-2">
              <div className="h-12 w-full max-w-[34rem] rounded-lg bg-slate-200" />
              <div className="h-12 w-3/4 max-w-[29rem] rounded-lg bg-slate-200" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-5 w-full max-w-xl rounded bg-slate-100" />
              <div className="h-5 w-4/5 max-w-lg rounded bg-slate-100" />
            </div>
            <div className="mt-7 h-11 w-52 rounded-full bg-slate-200" />
          </div>

          <div className="flex items-center">
            <div className="min-h-[234px] w-full rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 p-7 shadow-xl">
              <div className="h-[22px] w-24 rounded-full bg-white/15" />
              <div className="mt-4 h-8 w-4/5 rounded bg-white/15" />
              <div className="mt-2 space-y-2">
                <div className="h-4 w-full rounded bg-white/10" />
                <div className="h-4 w-3/4 rounded bg-white/10" />
              </div>
              <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="h-3 w-36 rounded bg-white/10" />
                <div className="mt-2 h-4 w-44 rounded bg-white/15" />
              </div>
            </div>
          </div>
        </section>

        <section
          className="grid min-h-[160px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          aria-hidden="true"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="h-8 w-8 rounded-lg bg-slate-100" />
                <div className="h-3 w-28 rounded bg-slate-100" />
              </div>
              <div className="mt-4 h-9 w-16 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-4/5 rounded bg-slate-100" />
            </div>
          ))}
        </section>

        <section
          className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]"
          aria-hidden="true"
        >
          <div className="min-h-[320px] rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="h-6 w-32 rounded bg-slate-200" />
              <div className="h-5 w-20 rounded-full bg-slate-100" />
            </div>
            <div className="mt-2 h-4 w-56 rounded bg-slate-100" />
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="h-[88px] rounded-2xl border border-slate-200 bg-slate-50" />
              <div className="h-[88px] rounded-2xl border border-slate-200 bg-slate-50" />
            </div>
          </div>

          <div className="min-h-[296px] rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="h-6 w-36 rounded bg-slate-200" />
              <div className="h-3 w-14 rounded bg-slate-100" />
            </div>
            <div className="mt-6 flex gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-slate-100" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 w-3/4 rounded bg-slate-100" />
                <div className="h-3 w-1/3 rounded bg-slate-100" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
