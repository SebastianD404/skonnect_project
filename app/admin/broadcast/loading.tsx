import { SkeletonBar } from "../components/AdminSkeletonPrimitives";

export default function BroadcastLoading() {
  return (
    <main role="status" aria-label="Loading broadcast composer" className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12 sm:gap-8">
      <header className="space-y-2">
        <SkeletonBar width="w-36" height="h-3" className="rounded-full bg-cyan-900/10" />
        <SkeletonBar width="w-72" height="h-8" />
        <SkeletonBar width="w-[34rem]" height="h-4" className="max-w-full bg-slate-100" />
      </header>
      <section aria-hidden="true" className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <SkeletonBar width="w-40" height="h-5" />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {[0, 1].map((field) => (
              <div key={field} className="space-y-2">
                <SkeletonBar width="w-24" height="h-3" />
                <SkeletonBar width="w-full" height="h-11" className="rounded-xl" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-6 p-5 sm:p-6">
          <section className="space-y-3">
            <SkeletonBar width="w-32" height="h-4" />
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1].map((option) => (
                <SkeletonBar key={option} width="w-full" height="h-16" className="rounded-xl" />
              ))}
            </div>
          </section>
          <div className="space-y-2">
            <SkeletonBar width="w-24" height="h-3" />
            <SkeletonBar width="w-full" height="h-11" className="rounded-xl" />
          </div>
          <section className="space-y-4">
            <SkeletonBar width="w-40" height="h-4" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[0, 1, 2].map((field) => (
                <div key={field} className="space-y-2">
                  <SkeletonBar width="w-24" height="h-3" />
                  <SkeletonBar width="w-full" height="h-11" className="rounded-xl" />
                </div>
              ))}
            </div>
          </section>
          <SkeletonBar width="w-full" height="h-32" className="rounded-2xl bg-slate-50" />
          <div className="flex justify-end">
            <SkeletonBar width="w-40" height="h-11" className="rounded-xl" />
          </div>
        </div>
      </section>
      <span className="sr-only">Loading broadcast form…</span>
    </main>
  );
}
