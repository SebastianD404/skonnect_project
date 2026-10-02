function SkeletonDetail({ valueClassName = "w-40" }: { valueClassName?: string }) {
  return (
    <div className="space-y-2">
      <div className="h-3 w-24 rounded-md bg-slate-200" />
      <div className={`h-4 max-w-full rounded-md bg-slate-200 ${valueClassName}`} />
    </div>
  );
}

function SkeletonSectionHeading() {
  return <div className="h-6 w-56 max-w-full rounded-md bg-slate-200" />;
}

export default function GranteeDetailLoading() {
  return (
    <div role="status" aria-label="Loading grantee details" className="animate-pulse space-y-6">
      <header className="flex flex-col gap-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div className="h-16 w-16 shrink-0 rounded-full bg-slate-200" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-7 w-64 max-w-full rounded-md bg-slate-200" />
          <div className="h-4 w-48 max-w-full rounded-md bg-slate-200" />
          <div className="h-6 w-28 rounded-full bg-slate-200" />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="h-10 w-32 rounded-lg bg-slate-200" />
          <div className="h-10 w-32 rounded-lg bg-slate-200" />
        </div>
      </header>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <SkeletonSectionHeading />
        <dl className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
          <SkeletonDetail valueClassName="w-48" />
          <SkeletonDetail valueClassName="w-56" />
          <SkeletonDetail valueClassName="w-32" />
          <SkeletonDetail valueClassName="w-40" />
          <SkeletonDetail valueClassName="w-28" />
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <SkeletonSectionHeading />
        <div className="mb-3 mt-5 h-4 w-36 rounded-md bg-slate-200" />
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
          <SkeletonDetail valueClassName="w-32" />
          <SkeletonDetail valueClassName="w-36" />
          <SkeletonDetail valueClassName="w-40" />
          <SkeletonDetail valueClassName="w-24" />
          <SkeletonDetail valueClassName="w-44" />
          <SkeletonDetail valueClassName="w-40" />
          <div className="space-y-2 md:col-span-3">
            <div className="h-3 w-32 rounded-md bg-slate-200" />
            <div className="h-4 w-full rounded-md bg-slate-200" />
          </div>
        </dl>
        <div className="my-4 border-t border-slate-100" />
        <div className="mb-3 h-4 w-40 rounded-md bg-slate-200" />
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
          <SkeletonDetail valueClassName="w-44" />
          <SkeletonDetail valueClassName="w-40" />
          <SkeletonDetail valueClassName="w-36" />
          <SkeletonDetail valueClassName="w-48" />
          <SkeletonDetail valueClassName="w-40" />
          <SkeletonDetail valueClassName="w-36" />
        </dl>
      </section>

      <span className="sr-only">Loading grantee profile and application details…</span>
    </div>
  );
}
