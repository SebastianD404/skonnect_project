const metricCards = Array.from({ length: 4 }, (_, index) => index);
const applicants = Array.from({ length: 3 }, (_, index) => index);
const profileFields = Array.from({ length: 8 }, (_, index) => index);

export default function SkeapApplicationsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading SKEAP applications"
      className="min-h-screen animate-pulse bg-slate-50 text-slate-900"
    >
      <div className="mx-auto flex min-h-screen max-w-[1480px] gap-6 px-6">
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 pb-12">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="space-y-2">
              <div className="h-3 w-36 rounded bg-slate-200" />
              <div className="h-8 w-72 max-w-full rounded bg-slate-200" />
              <div className="h-4 w-[32rem] max-w-full rounded bg-slate-200" />
            </div>
          </header>

          <section
            aria-label="Application status metrics"
            className="grid grid-cols-1 gap-4 md:grid-cols-4"
          >
            {metricCards.map((card) => (
              <div
                key={card}
                className="flex h-32 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="h-3 w-28 rounded bg-slate-200" />
                  <div className="h-7 w-7 rounded-full bg-slate-100" />
                </div>
                <div>
                  <div className="h-7 w-12 rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-24 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </section>

          <section className="grid min-h-[600px] grid-cols-1 items-start overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm lg:h-[calc(100vh-280px)] lg:grid-cols-[24rem_minmax(0,1fr)]">
            <aside className="flex min-h-[600px] flex-col border-b border-slate-200 bg-slate-50 lg:h-full lg:border-b-0 lg:border-r">
              <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 p-5">
                <div>
                  <div className="h-3 w-32 rounded bg-slate-200" />
                  <div className="mt-3 h-7 w-40 rounded bg-slate-200" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 flex-1 rounded-lg border border-slate-200 bg-white" />
                  <div className="h-9 w-9 rounded-lg border border-slate-200 bg-white" />
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-hidden p-4">
                {applicants.map((applicant) => (
                  <div
                    key={applicant}
                    className="h-28 rounded-xl border border-slate-100 bg-white p-5"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-4 w-40 max-w-full rounded bg-slate-200" />
                        <div className="h-3 w-32 max-w-full rounded bg-slate-100" />
                      </div>
                      <div className="h-6 w-20 rounded-full bg-slate-100" />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="h-3 w-24 rounded bg-slate-100" />
                      <div className="h-3 w-12 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-4">
                <div className="h-3 w-24 rounded bg-slate-200" />
                <div className="flex gap-2">
                  <div className="h-8 w-8 rounded-lg bg-slate-100" />
                  <div className="h-8 w-8 rounded-lg bg-slate-100" />
                </div>
              </div>
            </aside>

            <div className="flex min-h-[600px] min-w-0 flex-col bg-slate-50/50 lg:h-full">
              <div className="shrink-0 border-b border-slate-200 bg-white px-5 pt-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="h-3 w-36 rounded bg-slate-200" />
                    <div className="h-7 w-56 max-w-full rounded bg-slate-200" />
                    <div className="h-4 w-48 max-w-full rounded bg-slate-100" />
                  </div>
                  <div className="h-9 w-28 rounded-lg bg-slate-200" />
                </div>
                <div className="mt-4 flex gap-6 border-b border-slate-100">
                  <div className="h-8 w-16 rounded-t border-b-2 border-slate-300 bg-slate-100" />
                  <div className="h-8 w-32 rounded-t bg-slate-100" />
                  <div className="h-8 w-24 rounded-t bg-slate-100" />
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-hidden p-5">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-5 py-4">
                    <div className="h-4 w-32 rounded bg-slate-200" />
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-slate-100 md:grid-cols-4">
                    {profileFields.map((field) => (
                      <div key={field} className="space-y-2 bg-white p-4 md:p-5">
                        <div className="h-3 w-20 rounded bg-slate-100" />
                        <div className="h-4 w-28 max-w-full rounded bg-slate-200" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="h-12 rounded-3xl bg-slate-200" />
                  <div className="h-12 rounded-lg bg-slate-100" />
                </div>
              </div>
            </div>
          </section>
          <span className="sr-only">Loading SKEAP application records…</span>
        </main>
      </div>
    </div>
  );
}
