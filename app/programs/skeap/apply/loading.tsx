export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10" aria-busy="true">
      <section
        aria-label="Loading SKEAP application"
        className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="animate-pulse bg-slate-900 p-6 sm:p-8">
          <div className="h-3 w-36 rounded bg-slate-600" />
          <div className="mt-4 h-8 w-64 rounded-xl bg-slate-700" />
          <div className="mt-3 h-4 max-w-2xl rounded bg-slate-700" />
        </div>

        <div className="space-y-8 p-6 sm:p-8">
          {[0, 1, 2].map((row) => (
            <div key={row} className="grid gap-5 sm:grid-cols-2">
              {[0, 1].map((field) => (
                <div key={field} className="space-y-2">
                  <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
                  <div className="h-11 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
                </div>
              ))}
            </div>
          ))}

          <div className="h-28 animate-pulse rounded-xl border border-dashed border-slate-300 bg-slate-100" />
          <div className="flex justify-end">
            <div className="h-11 w-36 animate-pulse rounded-xl bg-slate-200" />
          </div>
        </div>
      </section>
    </main>
  );
}
