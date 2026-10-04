const waitlistRows = Array.from({ length: 5 }, (_, index) => index);

export default function SkeapWaitlistSkeleton() {
  return (
    <main
      role="status"
      aria-label="Loading SKEAP waitlist"
      className="mx-auto flex w-full animate-pulse flex-col gap-6 pb-12"
    >
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="max-w-2xl">
          <div className="h-3 w-44 rounded bg-slate-200" />
          <div className="mb-1.5 mt-2 h-8 w-56 max-w-full rounded bg-slate-200" />
          <div className="h-4 w-[38rem] max-w-full rounded bg-slate-100" />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-sm">
          <div className="h-6 w-32 rounded bg-slate-100" />
          <div className="h-6 w-px bg-slate-200" />
          <div className="h-4 w-24 rounded bg-slate-100" />
        </div>
      </header>

      <section className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row">
          <div className="h-9 w-full rounded-full border border-slate-200 bg-white sm:w-80" />
          <div className="h-9 w-full rounded-lg border border-slate-200 bg-white sm:w-36" />
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse whitespace-nowrap text-left text-sm">
            <thead className="bg-gradient-to-r from-slate-900 to-cyan-900">
              <tr>
                {["w-14", "w-24", "w-28", "w-20", "w-16"].map((width, index) => (
                  <th key={index} className={`px-6 py-4 ${index === 4 ? "text-right" : ""}`}>
                    <div className={`h-3 rounded bg-slate-600 ${width} ${index === 4 ? "ml-auto" : ""}`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {waitlistRows.map((row) => (
                <tr key={row} className="align-top">
                  <td className="px-6 py-4"><div className="h-6 w-10 rounded bg-slate-200" /></td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <div className="h-4 w-36 rounded bg-slate-200" />
                      <div className="h-3 w-44 rounded bg-slate-100" />
                      <div className="h-3 w-28 rounded bg-slate-100" />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <div className="h-4 w-32 rounded bg-slate-200" />
                      <div className="h-3 w-28 rounded bg-slate-100" />
                    </div>
                  </td>
                  <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-slate-100" /></td>
                  <td className="px-6 py-4">
                    <div className="ml-auto h-9 w-36 rounded-lg bg-slate-200" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 sm:flex-row">
          <div className="flex items-center gap-4">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="h-7 w-20 rounded-lg bg-white ring-1 ring-slate-200" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 rounded-lg bg-white ring-1 ring-slate-200" />
            <div className="h-4 w-24 rounded bg-slate-100" />
            <div className="h-8 w-20 rounded-lg bg-white ring-1 ring-slate-200" />
          </div>
        </div>
      </section>
      <span className="sr-only">Loading waitlist records…</span>
    </main>
  );
}
