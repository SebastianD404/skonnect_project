type SkeletonBarProps = {
  width?: string;
  height?: string;
  className?: string;
};

const PULSE = "animate-pulse motion-reduce:animate-none";

export function SkeletonBar({
  width = "w-full",
  height = "h-4",
  className = "",
}: SkeletonBarProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-md bg-slate-200/70 ${PULSE} ${width} ${height} ${className}`}
    />
  );
}

export function AdminPageHeaderSkeleton({
  eyebrowWidth = "w-36",
  titleWidth = "w-64",
  subtitleWidth = "w-[34rem]",
  withAction = false,
}: {
  eyebrowWidth?: string;
  titleWidth?: string;
  subtitleWidth?: string;
  withAction?: boolean;
}) {
  return (
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <SkeletonBar width={eyebrowWidth} height="h-3" className="rounded-full" />
        <SkeletonBar width={titleWidth} height="h-7" className="mb-1.5 mt-2 max-w-full" />
        <SkeletonBar width={subtitleWidth} height="h-4" className="max-w-full bg-slate-100" />
      </div>
      {withAction ? <SkeletonBar width="w-36" height="h-10" className="rounded-xl" /> : null}
    </header>
  );
}

export function AdminStatGridSkeleton({
  count = 4,
  columns = 4,
}: {
  count?: 3 | 4;
  columns?: 3 | 4;
}) {
  return (
    <section
      aria-hidden="true"
      className={`grid grid-cols-2 gap-3 sm:gap-4 ${columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
    >
      {Array.from({ length: count }, (_, index) => (
        <article
          key={index}
          className="flex min-h-[148px] min-w-0 flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm sm:min-h-[160px] sm:p-5"
        >
          <div className="flex items-start justify-between gap-3 sm:items-center">
            <SkeletonBar width="w-28" height="h-3" className="max-w-[75%] rounded-full" />
            <SkeletonBar width="w-7 sm:w-8" height="h-7 sm:h-8" className="shrink-0 rounded-full bg-cyan-50" />
          </div>
          <SkeletonBar width="w-20" height="h-8" className="mt-3" />
          <div className="mt-2 flex items-center justify-between gap-2">
            <SkeletonBar width="w-28" height="h-3" className="bg-slate-100" />
            <SkeletonBar width="w-14" height="h-5" className="rounded-full bg-emerald-50" />
          </div>
        </article>
      ))}
    </section>
  );
}

export function AdminFilterToolbarSkeleton({
  tabCount = 0,
  filterCount = 0,
  hasSearch = true,
  hasAction = false,
}: {
  tabCount?: number;
  filterCount?: number;
  hasSearch?: boolean;
  hasAction?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        {hasSearch ? (
          <SkeletonBar width="w-full sm:w-80" height="h-10" className="rounded-full bg-white ring-1 ring-slate-200" />
        ) : null}
        {tabCount ? (
          <div className="flex w-fit max-w-full items-center gap-1 overflow-hidden rounded-xl bg-slate-100 p-1">
            {Array.from({ length: tabCount }, (_, index) => (
              <SkeletonBar key={index} width="w-20" height="h-8" className="shrink-0 rounded-lg bg-white/70" />
            ))}
          </div>
        ) : null}
        {filterCount ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: filterCount }, (_, index) => (
              <SkeletonBar key={index} width="w-28" height="h-9" className="rounded-xl" />
            ))}
          </div>
        ) : null}
      </div>
      {hasAction ? <SkeletonBar width="w-36" height="h-10" className="rounded-xl" /> : null}
    </div>
  );
}

export function AdminTableCardSkeleton({
  columns = 6,
  rowCount = 5,
  statusColumns = [],
  actionSlots = 1,
  hasFooter = true,
  hasToolbar = true,
  tabCount = 0,
  filterCount = 0,
  hasToolbarAction = false,
  minTableWidth = "min-w-[900px]",
}: {
  columns?: number;
  rowCount?: number;
  statusColumns?: number[];
  actionSlots?: number;
  hasFooter?: boolean;
  hasToolbar?: boolean;
  tabCount?: number;
  filterCount?: number;
  hasToolbarAction?: boolean;
  minTableWidth?: string;
}) {
  return (
    <section className="w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      {hasToolbar ? (
        <AdminFilterToolbarSkeleton
          tabCount={tabCount}
          filterCount={filterCount}
          hasAction={hasToolbarAction}
        />
      ) : null}
      <div className="flex flex-col gap-3 p-3 md:hidden">
        {Array.from({ length: rowCount }, (_, row) => (
          <article key={row} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBar width={row % 2 ? "w-40" : "w-32"} height="h-4" className="max-w-full" />
                <SkeletonBar width="w-48" height="h-3" className="max-w-full bg-slate-100" />
              </div>
              <SkeletonBar width="w-20" height="h-6" className="shrink-0 rounded-full bg-amber-50" />
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              {Array.from({ length: Math.max(2, columns - 2) }, (_, field) => (
                <div key={field} className="space-y-2">
                  <SkeletonBar width="w-16" height="h-2.5" className="bg-slate-100" />
                  <SkeletonBar width={field % 2 ? "w-24" : "w-32"} height="h-3" className="max-w-full" />
                </div>
              ))}
            </div>
            {actionSlots > 0 ? (
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                {Array.from({ length: actionSlots }, (_, action) => (
                  <SkeletonBar key={action} width="w-20" height="h-9" className="rounded-lg" />
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
      <div className="hidden w-full overflow-x-auto md:block">
        <table className={`w-full ${minTableWidth} border-collapse text-left text-sm`}>
          <thead className="border-y border-slate-200/80 bg-slate-50/80">
            <tr>
              {Array.from({ length: columns }, (_, column) => (
                <th key={column} className="px-4 py-3.5">
                  <SkeletonBar width={column % 2 ? "w-20" : "w-28"} height="h-3" className="rounded-full" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rowCount }, (_, row) => (
              <tr key={row} className="h-[68px]">
                {Array.from({ length: columns }, (_, column) => (
                  <td key={column} className="px-4 py-4">
                    {statusColumns.includes(column) ? (
                      <SkeletonBar width="w-24" height="h-6" className="rounded-full bg-slate-100" />
                    ) : column === columns - 1 && actionSlots > 0 ? (
                      <div className="flex justify-end gap-2">
                        {Array.from({ length: actionSlots }, (_, action) => (
                          <SkeletonBar key={action} width="w-9" height="h-9" className="rounded-lg" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <SkeletonBar width={row % 2 ? "w-32" : "w-24"} height="h-3.5" className="max-w-full" />
                        {column < 2 ? (
                          <SkeletonBar width="w-28" height="h-3" className="max-w-full bg-slate-100" />
                        ) : null}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasFooter ? (
        <div className="flex flex-col gap-3 border-t border-slate-200/80 bg-slate-50/50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center justify-between gap-4 sm:justify-start">
            <SkeletonBar width="w-32" height="h-4" />
            <SkeletonBar width="w-24" height="h-8" className="rounded-lg bg-white ring-1 ring-slate-200" />
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <SkeletonBar width="w-16" height="h-8" className="rounded-lg bg-white ring-1 ring-slate-200" />
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 5 }, (_, index) => (
                <SkeletonBar key={index} width="w-8" height="h-8" className="rounded-lg bg-white ring-1 ring-slate-200" />
              ))}
            </div>
            <SkeletonBar width="w-16" height="h-8" className="rounded-lg bg-white ring-1 ring-slate-200" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
