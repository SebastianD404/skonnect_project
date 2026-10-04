const tabs = Array.from({ length: 4 }, (_, index) => index);
const rows = Array.from({ length: 5 }, (_, index) => index);

export default function SubmissionReviewSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading scholarship document review"
      className="flex w-full animate-pulse flex-col gap-6 pb-12"
    >
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="h-3 w-40 rounded bg-slate-200" />
          <div className="mb-1.5 mt-2 h-8 w-80 max-w-full rounded bg-slate-200" />
          <div className="h-4 w-[34rem] max-w-full rounded bg-slate-100" />
        </div>
        <div className="h-9 w-36 shrink-0 rounded-xl border border-slate-200 bg-white" />
      </header>

      <section className="flex h-fit flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5 xl:flex-row xl:items-center">
          <div className="h-9 w-full rounded-full border border-slate-200 bg-white xl:w-80" />
          <div className="flex w-full shrink-0 items-center gap-1.5 overflow-hidden xl:w-auto xl:justify-end">
            {tabs.map((tab) => (
              <div key={tab} className="h-8 w-28 shrink-0 rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>

        <div className="flex h-[52px] items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5">
          <div className="h-3 w-48 rounded bg-slate-200" />
          <div className="h-7 w-40 rounded-lg bg-slate-100" />
        </div>

        <div className="relative w-full overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead className="bg-gradient-to-r from-slate-900 to-cyan-900">
              <tr>
                {["w-24", "w-16", "w-24", "w-12", "w-20", "w-16"].map((width, index) => (
                  <th key={index} className="px-6 py-4">
                    <div className={`h-3 rounded bg-slate-600 ${width}`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rows.map((row) => (
                <tr key={row}>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <div className="h-4 w-32 rounded bg-slate-200" />
                      <div className="h-3 w-40 rounded bg-slate-100" />
                    </div>
                  </td>
                  <td className="px-6 py-4"><div className="h-4 w-20 rounded bg-slate-100" /></td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <div className="h-4 w-28 rounded bg-slate-200" />
                      <div className="h-3 w-20 rounded bg-slate-100" />
                    </div>
                  </td>
                  <td className="px-6 py-4"><div className="h-4 w-10 rounded bg-slate-100" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-slate-100" /></td>
                  <td className="px-6 py-4">
                    <div className="ml-auto h-8 w-20 rounded-full bg-slate-100" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 rounded-lg bg-white ring-1 ring-slate-200" />
            <div className="h-4 w-24 rounded bg-slate-100" />
            <div className="h-8 w-20 rounded-lg bg-white ring-1 ring-slate-200" />
          </div>
        </div>
      </section>
      <span className="sr-only">Loading scholarship submission records…</span>
    </div>
  );
}
