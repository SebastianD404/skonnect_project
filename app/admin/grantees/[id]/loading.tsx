const details = [0, 1, 2, 3, 4, 5, 6];
const submissions = [0, 1, 2, 3, 4];
const documents = [0, 1, 2, 3];

function SkeletonDetail({ className = "w-40" }: { className?: string }) {
  return (
    <div className="space-y-2">
      <div className="h-3 w-24 rounded-md bg-slate-200" />
      <div className={`h-4 max-w-full rounded-md bg-slate-200 ${className}`} />
    </div>
  );
}

export default function GranteeDetailLoading() {
  return (
    <div
      role="status"
      aria-label="Loading grantee details"
      className="mx-auto flex w-full max-w-7xl animate-pulse motion-reduce:animate-none flex-col gap-6 pb-8 sm:gap-8"
    >
      <header className="mb-6">
        <div className="h-4 w-32 rounded-md bg-slate-200" />
      </header>

      <div className="space-y-6">
        <header className="relative flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-6">
          <div className="flex min-w-0 flex-1 items-center gap-3.5 sm:gap-5">
            <div className="h-12 w-12 shrink-0 rounded-full bg-slate-200 sm:h-16 sm:w-16" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-32 rounded bg-slate-100" />
              <div className="h-5 w-56 max-w-full rounded bg-slate-200" />
              <div className="h-4 w-48 max-w-full rounded bg-slate-100" />
            </div>
          </div>
          <div className="flex w-full items-center justify-end gap-2 border-t border-slate-100 pt-3 sm:w-auto sm:border-t-0 sm:pt-0">
            <div className="h-9 w-9 rounded-xl border border-slate-200 bg-white sm:h-10 sm:w-40" />
            <div className="h-9 w-32 rounded-xl bg-slate-200 sm:h-10" />
          </div>
        </header>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="h-6 w-56 max-w-full rounded-md bg-slate-200" />
          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-3">
            <SkeletonDetail className="w-48" />
            <SkeletonDetail className="w-56" />
            <SkeletonDetail className="w-32" />
            <SkeletonDetail className="w-40" />
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="h-6 w-56 max-w-full rounded-md bg-slate-200" />
          <div className="mb-3 mt-5 h-4 w-36 rounded-md bg-slate-200" />
          <dl className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
            {details.map((detail) => (
              <SkeletonDetail key={detail} className={detail === 6 ? "w-full" : "w-40"} />
            ))}
          </dl>
          <div className="my-4 border-t border-slate-100" />
          <div className="mb-3 h-4 w-40 rounded-md bg-slate-200" />
          <dl className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
            {details.slice(0, 6).map((detail) => (
              <SkeletonDetail key={detail} className="w-40" />
            ))}
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="h-6 w-48 max-w-full rounded-md bg-slate-200" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {documents.map((document) => (
              <article key={document} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-100" />
                  <div className="min-w-0 space-y-2">
                    <div className="h-4 w-40 max-w-full rounded bg-slate-200" />
                    <div className="h-3 w-28 max-w-full rounded bg-slate-100" />
                  </div>
                </div>
                <div className="h-8 w-8 shrink-0 rounded-lg bg-slate-100" />
              </article>
            ))}
          </div>
        </section>

        <section className="w-full rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="h-6 w-56 max-w-full rounded-md bg-slate-200" />
            <div className="h-7 w-24 shrink-0 rounded-full bg-slate-100" />
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {submissions.map((submission) => (
              <li key={submission} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-40 rounded bg-slate-200" />
                  <div className="h-3 w-24 rounded bg-slate-100" />
                </div>
                <div className="h-3 w-44 rounded bg-slate-100" />
              </li>
            ))}
          </ul>
        </section>
      </div>
      <span className="sr-only">Loading grantee profile and application details…</span>
    </div>
  );
}
