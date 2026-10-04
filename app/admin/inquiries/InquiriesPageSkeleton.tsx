const metricCards = Array.from({ length: 4 }, (_, index) => index);
const inquiryRows = Array.from({ length: 5 }, (_, index) => index);

export default function InquiriesPageSkeleton() {
  return (
    <main
      role="status"
      aria-label="Loading inquiries"
      className="mx-auto flex w-full animate-pulse flex-col gap-6 pb-12"
    >
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="max-w-2xl">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="mb-1.5 mt-2 h-8 w-48 max-w-full rounded bg-slate-200" />
          <div className="h-4 w-80 max-w-full rounded bg-slate-100" />
        </div>
      </header>

      <section
        aria-label="Inquiry metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metricCards.map((card) => (
          <div
            key={card}
            className="flex min-h-[172px] min-w-0 flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="h-3 w-28 rounded bg-slate-200" />
              <div className="h-9 w-9 shrink-0 rounded-2xl bg-cyan-50" />
            </div>
            <div className="mt-4 h-9 w-20 rounded bg-slate-200" />
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="h-3 w-28 rounded bg-slate-100" />
              <div className="h-5 w-14 rounded-full bg-emerald-50" />
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-100 bg-white p-4 sm:flex-row sm:p-5">
          <div className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 sm:w-80" />
          <div className="flex w-full shrink-0 items-center overflow-hidden rounded-xl bg-slate-100 p-1 sm:w-auto">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-8 w-20 shrink-0 rounded-lg bg-white/70" />
            ))}
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead className="bg-gradient-to-r from-slate-900 to-cyan-900">
              <tr className="border-b border-slate-800">
                {[
                  ["w-[25%]", "w-16"],
                  ["w-[20%]", "w-10"],
                  ["w-[12%]", "w-12"],
                  ["w-[13%]", "w-16"],
                  ["w-[14%]", "w-16"],
                  ["w-[16%]", "w-14"],
                ].map(([columnWidth, textWidth], index) => (
                  <th
                    key={index}
                    className={`px-4 py-4 ${index === 0 ? "pl-6 sm:pl-8" : ""} ${index === 5 ? "pl-8 pr-6 sm:pl-9" : ""}`}
                  >
                    <div className={`h-3 rounded bg-slate-600 ${columnWidth} ${textWidth}`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {inquiryRows.map((row) => (
                <tr key={row}>
                  <td className="max-w-0 px-4 py-4 pl-6 sm:pl-8">
                    <div className="space-y-2">
                      <div className="h-4 w-36 max-w-full rounded bg-slate-200" />
                      <div className="h-3 w-48 max-w-full rounded bg-slate-100" />
                    </div>
                  </td>
                  <td className="max-w-0 px-4 py-4">
                    <div className="space-y-2">
                      <div className="h-4 w-28 max-w-full rounded bg-slate-200" />
                      <div className="h-3 w-36 max-w-full rounded bg-slate-100" />
                    </div>
                  </td>
                  <td className="px-4 py-4"><div className="h-6 w-14 rounded-full bg-amber-50" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-20 rounded bg-slate-100" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-20 rounded bg-slate-100" /></td>
                  <td className="px-4 py-4 sm:px-6">
                    <div className="ml-auto h-8 w-20 rounded-lg bg-slate-100" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <span className="sr-only">Loading inquiry records…</span>
    </main>
  );
}
