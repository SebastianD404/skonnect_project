import { SkeletonBar } from "../components/AdminSkeletonPrimitives";

const ledgerRows = [0, 1, 2, 3, 4];

export default function AccountingLoading() {
  return (
    <main role="status" aria-label="Loading accounting" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-12 pt-8 sm:gap-8 sm:px-6">
      <header className="flex w-full flex-col justify-between gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div>
          <SkeletonBar width="w-[22rem]" height="h-7" className="max-w-full" />
          <SkeletonBar width="w-[30rem]" height="h-4" className="mt-1 max-w-full bg-slate-100" />
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <SkeletonBar width="w-full sm:w-40" height="h-10" className="rounded-xl" />
          <SkeletonBar width="w-full sm:w-64 lg:w-72" height="h-10" className="rounded-2xl bg-white" />
        </div>
      </header>
      <section aria-hidden="true" className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="min-h-[168px] rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <SkeletonBar width="w-9" height="h-9" className="rounded-lg bg-slate-50" />
            <SkeletonBar width="w-28" height="h-4" />
          </div>
          <SkeletonBar width="w-32" height="h-3" className="mt-4 bg-slate-100" />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <SkeletonBar width="w-full sm:w-60" height="h-10" className="rounded-xl" />
            <SkeletonBar width="w-32" height="h-4" className="bg-slate-100" />
            <SkeletonBar width="w-24" height="h-10" className="rounded-xl" />
          </div>
        </article>
        <article className="min-h-[168px] rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <SkeletonBar width="w-28" height="h-4" />
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="space-y-2">
              <SkeletonBar width="w-36" height="h-10" />
              <SkeletonBar width="w-44" height="h-3" className="bg-slate-100" />
            </div>
            <div className="space-y-2">
              <SkeletonBar width="w-28" height="h-3" className="bg-slate-100" />
              <SkeletonBar width="w-32" height="h-3" className="bg-slate-100" />
            </div>
          </div>
        </article>
      </section>

      <section aria-hidden="true" className="mt-6 space-y-6">
        <div className="flex w-full flex-col gap-3">
          <SkeletonBar width="w-full" height="h-11" className="rounded-2xl bg-white shadow-sm" />
          <div className="hidden flex-wrap gap-3 sm:flex">
            {[0, 1].map((group) => (
              <div key={group} className="flex gap-1 rounded-full border border-slate-100 bg-white p-1 shadow-sm">
                {[0, 1, 2].map((filter) => (
                  <SkeletonBar key={filter} width="w-24" height="h-8" className="rounded-2xl bg-slate-100" />
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:hidden">
            <SkeletonBar width="w-full" height="h-10" className="rounded-xl" />
            <SkeletonBar width="w-full" height="h-10" className="rounded-xl" />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <SkeletonBar width="w-36" height="h-4" className="mx-2 my-2" />
          <div className="mt-2 overflow-hidden rounded-xl border border-slate-100">
            <div className="flex gap-8 border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              {[0, 1, 2, 3, 4].map((column) => <SkeletonBar key={column} width="w-28" height="h-3" />)}
            </div>
            {ledgerRows.map((row) => (
              <div key={row} className="flex min-h-[68px] items-center gap-8 border-b border-slate-100 px-6 py-4">
                <SkeletonBar width="w-40" height="h-4" />
                <SkeletonBar width="w-28" height="h-4" />
                <SkeletonBar width="w-24" height="h-6" className="rounded-full bg-emerald-50" />
                <SkeletonBar width="w-28" height="h-6" className="rounded-full bg-amber-50" />
                <SkeletonBar width="w-32" height="h-4" className="bg-slate-100" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-slate-100 pt-4">
            <SkeletonBar width="w-28" height="h-4" />
            <SkeletonBar width="w-36" height="h-8" className="rounded-lg" />
          </div>
        </div>
      </section>
      <span className="sr-only">Loading cash disbursement records…</span>
    </main>
  );
}
