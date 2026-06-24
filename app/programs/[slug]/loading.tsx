export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F3F7FB] text-slate-900">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="h-4 w-56 rounded bg-slate-200 animate-pulse" />
              <div className="h-10 w-full rounded bg-slate-200 animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-slate-200 animate-pulse" />
            </div>

            <div className="flex gap-3">
              <div className="h-10 w-48 rounded-full bg-slate-200 animate-pulse" />
              <div className="h-10 w-48 rounded-full bg-slate-200 animate-pulse" />
            </div>
          </div>
        </div>

        <section className="grid gap-8 xl:grid-cols-[1.6fr_0.9fr]">
          <div className="space-y-8">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="grid gap-6 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                    <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
                    <div className="mt-3 h-8 w-20 rounded bg-slate-200 animate-pulse" />
                    <div className="mt-3 h-2 rounded-full bg-slate-200">
                      <div className="h-2 w-1/2 rounded-full bg-slate-300 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="h-6 w-40 rounded bg-slate-200 animate-pulse" />
              <div className="mt-6 h-8 w-64 rounded bg-slate-200 animate-pulse" />
              <div className="mt-4 h-4 w-3/4 rounded bg-slate-200 animate-pulse" />
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                    <div className="h-4 w-10 rounded bg-slate-200 animate-pulse" />
                    <div className="mt-4 h-3 w-3/4 rounded bg-slate-200 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="sticky top-24 self-start space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
              <ul className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="h-3 w-32 rounded bg-slate-200 animate-pulse" />
                ))}
              </ul>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-5 w-44 rounded bg-slate-200 animate-pulse" />
              <div className="mt-3 h-4 w-56 rounded bg-slate-200 animate-pulse" />
              <div className="mt-6 h-10 w-full rounded bg-slate-200 animate-pulse" />
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
