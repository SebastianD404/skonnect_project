import { AdminPageHeaderSkeleton, SkeletonBar } from "../../components/AdminSkeletonPrimitives";

const rows = [0, 1, 2, 3, 4];
const columns = [0, 1, 2, 3, 4];

export default function NonCompliantGranteesLoading() {
  return (
    <main role="status" aria-label="Loading non-compliant grantees" className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12">
      <AdminPageHeaderSkeleton titleWidth="w-72" subtitleWidth="w-[36rem]" />
      <section aria-hidden="true" className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <header className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <SkeletonBar width="w-40" height="h-4" />
            <SkeletonBar width="w-56" height="h-3" className="bg-slate-100" />
          </div>
          <SkeletonBar width="w-28" height="h-6" className="rounded-full bg-amber-50" />
        </header>
        <div className="flex flex-col gap-2 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center">
          <SkeletonBar width="w-full sm:max-w-sm" height="h-10" className="rounded-xl bg-white ring-1 ring-slate-200" />
          <SkeletonBar width="w-full sm:w-20" height="h-10" className="rounded-xl" />
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-5 py-3">
                    <SkeletonBar width={column === 3 ? "w-48" : "w-24"} height="h-3" className="rounded-full" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row} className="h-[76px]">
                  {columns.map((column) => (
                    <td key={column} className="px-5 py-4">
                      {column === 2 ? (
                        <SkeletonBar width="w-24" height="h-6" className="rounded-full bg-amber-50" />
                      ) : (
                        <div className="space-y-2">
                          <SkeletonBar width={column === 3 ? "w-56" : "w-32"} height="h-3.5" className="max-w-full" />
                          {column < 2 ? <SkeletonBar width="w-28" height="h-3" className="bg-slate-100" /> : null}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-col gap-3 border-t border-slate-200/80 bg-slate-50/50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center justify-between gap-4 sm:justify-start">
            <SkeletonBar width="w-32" height="h-4" />
            <SkeletonBar width="w-24" height="h-8" className="rounded-lg bg-white ring-1 ring-slate-200" />
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <SkeletonBar width="w-16" height="h-8" className="rounded-lg bg-white ring-1 ring-slate-200" />
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3, 4].map((page) => (
                <SkeletonBar key={page} width="w-8" height="h-8" className="rounded-lg bg-white ring-1 ring-slate-200" />
              ))}
            </div>
            <SkeletonBar width="w-16" height="h-8" className="rounded-lg bg-white ring-1 ring-slate-200" />
          </div>
        </footer>
      </section>
      <span className="sr-only">Loading compliance records…</span>
    </main>
  );
}
