const tabs = Array.from({ length: 4 }, (_, index) => index);
const records = Array.from({ length: 4 }, (_, index) => index);

function Placeholder({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

function QueueSkeleton() {
  return (
    <section className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:col-span-4 lg:h-full lg:min-h-0">
      <div className="flex shrink-0 items-center gap-3 bg-slate-900 px-5 py-4">
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-slate-700" />
        <div className="space-y-2">
          <Placeholder className="h-3 w-32 bg-slate-600" />
          <Placeholder className="h-2.5 w-24 bg-slate-700" />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-4">
        {records.map((record) => (
          <article key={record} className="space-y-3 rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <Placeholder className="h-3.5 w-32 max-w-[60%]" />
              <div className="h-5 w-20 shrink-0 animate-pulse rounded-full bg-slate-100" />
            </div>
            <Placeholder className="h-3 w-40 max-w-full bg-slate-100" />
            <div className="flex items-center justify-between gap-3">
              <Placeholder className="h-2.5 w-28 max-w-[60%] bg-slate-100" />
              <Placeholder className="h-2.5 w-16 bg-slate-100" />
            </div>
          </article>
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 p-4">
        <Placeholder className="h-3 w-36 bg-slate-100" />
        <Placeholder className="h-8 w-20 rounded-lg bg-white" />
      </div>
    </section>
  );
}

function ReviewSkeleton() {
  return (
    <section className="hidden min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-8 lg:flex lg:h-full lg:min-h-0">
      <div className="shrink-0 border-b border-slate-100 pb-3">
        <Placeholder className="mb-2 h-3 w-28 bg-slate-100" />
        <Placeholder className="mb-2 h-6 w-40" />
        <Placeholder className="h-3 w-72 max-w-full bg-slate-100" />
      </div>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1].map((document) => (
          <div key={document} className="flex min-h-0 flex-col rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <Placeholder className="h-3.5 w-32" />
              {document === 1 ? <Placeholder className="h-4 w-20 rounded-full bg-slate-100" /> : null}
            </div>
            <Placeholder className="mt-3 h-32 w-full bg-slate-200/60" />
            <Placeholder className="my-3 min-h-[60px] flex-1 bg-slate-200/40" />
            <div className="flex gap-2">
              <Placeholder className="h-8 flex-1 rounded-lg bg-slate-200/60" />
              <Placeholder className="h-8 flex-1 rounded-lg bg-slate-200/60" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function SubmissionReviewSkeleton() {
  return (
    <div role="status" aria-label="Loading scholarship document review" className="flex w-full animate-pulse flex-col gap-6 pb-12">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Placeholder className="h-3 w-40" />
          <Placeholder className="mb-1.5 mt-2 h-8 w-80 max-w-full" />
          <Placeholder className="h-4 w-[34rem] max-w-full bg-slate-100" />
        </div>
      </header>

      <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="p-4 sm:p-5">
          <div className="flex w-full min-w-0 items-center gap-3">
            <Placeholder className="h-10 min-w-0 flex-1 rounded-xl bg-white ring-1 ring-slate-200" />
            <Placeholder className="h-10 w-10 shrink-0 rounded-xl bg-slate-800" />
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <Placeholder className="h-10 w-full rounded-xl bg-white ring-1 ring-slate-200 sm:hidden" />
            <div className="hidden max-w-full flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 sm:flex">
              {tabs.map((tab) => <Placeholder key={tab} className="h-8 w-28 rounded-lg bg-slate-200" />)}
            </div>
          </div>
          <div className="mt-3 flex justify-start lg:justify-end">
            <Placeholder className="h-3 w-64 max-w-full bg-slate-100" />
          </div>
        </div>

        <div className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
          <div className="grid grid-cols-1 items-stretch gap-6 lg:h-[calc(100vh-220px)] lg:min-h-[600px] lg:grid-cols-12">
            <QueueSkeleton />
            <ReviewSkeleton />
          </div>
        </div>
      </section>
      <span className="sr-only">Loading scholarship document review…</span>
    </div>
  );
}
