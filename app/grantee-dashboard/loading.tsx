export default function GranteeDashboardLoading() {
  return (
    <main className="min-h-screen bg-[#F8FBFF] px-6 py-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="h-14 w-1/3 rounded-full bg-slate-200 animate-pulse" />
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-4 w-1/2 rounded bg-slate-200 animate-pulse" />
            <div className="space-y-3">
              <div className="h-28 rounded-[1.5rem] bg-slate-200 animate-pulse" />
              <div className="h-4 w-5/6 rounded bg-slate-200 animate-pulse" />
            </div>
          </div>
          <div className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-4 w-2/3 rounded bg-slate-200 animate-pulse" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-20 rounded-[1.5rem] bg-slate-200 animate-pulse" />
              <div className="h-20 rounded-[1.5rem] bg-slate-200 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
