const skeletonRows = Array.from({ length: 6 }, (_, index) => index);

function Placeholder({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}

function Breadcrumb() {
  return (
    <div className="mb-6 flex items-center gap-2">
      <Placeholder className="h-3 w-20" />
      <Placeholder className="h-3 w-2" />
      <Placeholder className="h-3 w-24" />
    </div>
  );
}

function PageHeader({ titleWidth = "w-56" }: { titleWidth?: string }) {
  return (
    <header className="space-y-2">
      <Placeholder className="h-3 w-24" />
      <Placeholder className={`h-12 max-w-full ${titleWidth}`} />
      <Placeholder className="h-4 w-[min(38rem,100%)]" />
    </header>
  );
}

function TableRows({ columns, showTitle = true }: { columns: number; showTitle?: boolean }) {
  const columnGridClass = columns === 6 ? "grid-cols-6" : "grid-cols-4";
  return (
    <section aria-hidden="true" className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      {showTitle ? (
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-6 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <Placeholder className="h-5 w-56 max-w-full" />
            <Placeholder className="h-3 w-72 max-w-full" />
          </div>
          <Placeholder className="h-8 w-32" />
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <div className={`grid min-w-[900px] ${columnGridClass} gap-6 bg-slate-900 px-6 py-4`}>
          {Array.from({ length: columns }, (_, index) => (
            <Placeholder key={index} className="h-3 w-20 bg-slate-700" />
          ))}
        </div>
        {skeletonRows.map((row) => (
          <div key={row} className={`grid min-w-[900px] ${columnGridClass} items-center gap-6 border-b border-slate-100 px-6 py-5`}>
            {Array.from({ length: columns }, (_, index) => (
              <div key={index} className="space-y-2">
                <Placeholder className={`h-3 ${index === 0 ? "w-32" : "w-20"}`} />
                {index === 0 ? <Placeholder className="h-2.5 w-28 max-w-full" /> : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function SystemAdminUsersSkeleton() {
  return (
    <div role="status" aria-label="Loading users and roles" className="flex flex-col gap-6 sm:gap-8 w-full">
      <div className="flex items-center gap-2">
        <Placeholder className="h-3 w-20" />
        <Placeholder className="h-3 w-2" />
        <Placeholder className="h-3 w-12" />
      </div>
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Placeholder className="h-3 w-24" />
          <Placeholder className="h-12 w-72 max-w-full" />
          <Placeholder className="h-4 w-[min(38rem,100%)]" />
        </div>
        <Placeholder className="h-10 w-44 shrink-0 rounded-xl" />
      </header>
      <section aria-hidden="true" className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <Placeholder className="h-10 w-full max-w-md rounded-xl" />
          <div className="flex flex-wrap items-center gap-2">
            <Placeholder className="h-10 w-28 rounded-xl" />
            <Placeholder className="h-10 w-24 rounded-xl" />
            <Placeholder className="hidden h-4 w-32 rounded-md sm:block" />
          </div>
        </div>
        <TableRows columns={6} />
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row">
          <Placeholder className="h-4 w-36" />
          <div className="flex items-center gap-2">
            <Placeholder className="h-8 w-20 rounded-lg" />
            <Placeholder className="h-8 w-8 rounded-lg" />
            <Placeholder className="h-8 w-8 rounded-lg" />
            <Placeholder className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      </section>
      <span className="sr-only">Loading user records…</span>
    </div>
  );
}

export function SystemAdminAuditSkeleton() {
  return (
    <div role="status" aria-label="Loading audit logs" className="flex flex-col gap-6 sm:gap-8 w-full">
      <Breadcrumb />
      <PageHeader titleWidth="w-60" />
      <section aria-hidden="true" className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <Placeholder className="h-10 w-full max-w-md rounded-xl" />
          <div className="flex items-center gap-2">
            <Placeholder className="h-10 w-36 rounded-xl" />
            <Placeholder className="h-10 w-32 rounded-xl" />
          </div>
        </div>
        <TableRows columns={4} showTitle={false} />
        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/50 px-4 py-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-4">
            <Placeholder className="h-4 w-44" />
            <Placeholder className="h-7 w-24 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <Placeholder className="h-8 w-24 rounded-xl" />
            <Placeholder className="h-4 w-24" />
            <Placeholder className="h-8 w-16 rounded-xl" />
          </div>
        </div>
      </section>
      <span className="sr-only">Loading audit records…</span>
    </div>
  );
}

export function SystemAdminDashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading system administration dashboard" className="flex flex-col gap-6 sm:gap-8 w-full">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <Placeholder className="h-3 w-48" />
          <Placeholder className="h-8 w-64 max-w-full" />
          <Placeholder className="h-4 w-[min(36rem,100%)]" />
        </div>
        <Placeholder className="h-10 w-36" />
      </div>
      <section aria-hidden="true" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 w-full">
        {skeletonRows.slice(0, 4).map((card) => (
          <div key={card} className="flex h-36 flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <Placeholder className="h-3 w-28" />
            <Placeholder className="h-9 w-20" />
            <Placeholder className="h-3 w-36 max-w-full" />
          </div>
        ))}
      </section>
      <section aria-hidden="true" className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 w-full">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <Placeholder className="mb-6 h-6 w-40" />
          {skeletonRows.slice(0, 4).map((row) => (
            <div key={row} className="flex items-center gap-4 border-t border-slate-100 py-5">
              <Placeholder className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Placeholder className="h-3 w-40 max-w-full" />
                <Placeholder className="h-3 w-56 max-w-full" />
              </div>
              <Placeholder className="h-3 w-20" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Placeholder className="mb-6 h-6 w-40" />
          <Placeholder className="h-4 w-48 max-w-full" />
          <Placeholder className="mt-6 h-3 w-full" />
          <Placeholder className="mt-3 h-3 w-4/5" />
          <Placeholder className="mt-8 h-10 w-full" />
        </div>
      </section>
      <span className="sr-only">Loading system dashboard…</span>
    </div>
  );
}
