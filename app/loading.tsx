export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F8FBFF] text-slate-900">
      <main className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
        <div className="space-y-8">
          <div className="h-14 w-1/2 rounded-full bg-slate-200 animate-pulse" />
          <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="h-4 w-36 rounded bg-slate-200 animate-pulse" />
                <div className="mt-6 space-y-4">
                  <div className="h-24 rounded-[1.75rem] bg-slate-200 animate-pulse" />
                  <div className="h-4 w-3/4 rounded bg-slate-200 animate-pulse" />
                  <div className="h-4 w-5/6 rounded bg-slate-200 animate-pulse" />
                </div>
              </div>
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="h-20 rounded-[1.5rem] bg-slate-200 animate-pulse" />
                  <div className="h-20 rounded-[1.5rem] bg-slate-200 animate-pulse" />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="h-4 w-40 rounded bg-slate-200 animate-pulse" />
                <div className="mt-5 space-y-4">
                  <div className="h-4 w-full rounded bg-slate-200 animate-pulse" />
                  <div className="h-4 w-5/6 rounded bg-slate-200 animate-pulse" />
                  <div className="h-4 w-2/3 rounded bg-slate-200 animate-pulse" />
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="h-4 w-28 rounded bg-slate-200 animate-pulse" />
                  <div className="mt-5 h-10 w-3/4 rounded bg-slate-200 animate-pulse" />
                </div>
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="h-4 w-28 rounded bg-slate-200 animate-pulse" />
                  <div className="mt-5 h-10 w-1/2 rounded bg-slate-200 animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
              <div className="mt-4 space-y-3">
                <div className="h-4 w-full rounded bg-slate-200 animate-pulse" />
                <div className="h-4 w-5/6 rounded bg-slate-200 animate-pulse" />
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-4 w-28 rounded bg-slate-200 animate-pulse" />
              <div className="mt-4 space-y-3">
                <div className="h-4 w-full rounded bg-slate-200 animate-pulse" />
                <div className="h-4 w-4/6 rounded bg-slate-200 animate-pulse" />
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
              <div className="mt-4 space-y-3">
                <div className="h-4 w-full rounded bg-slate-200 animate-pulse" />
                <div className="h-4 w-3/5 rounded bg-slate-200 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
