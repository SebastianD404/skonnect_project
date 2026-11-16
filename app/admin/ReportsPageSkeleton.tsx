import { SkeletonBar } from "./components/AdminSkeletonPrimitives";

const sections = [0, 1, 2];

export default function ReportsPageSkeleton() {
  return (
    <main role="status" aria-label="Loading reports" className="mx-auto flex w-full max-w-6xl flex-col gap-6 text-slate-950">
      <header className="space-y-2">
        <SkeletonBar width="w-36" height="h-3" className="rounded-full bg-cyan-900/10" />
        <SkeletonBar width="w-56" height="h-8" />
        <SkeletonBar width="w-[36rem]" height="h-4" className="max-w-full bg-slate-100" />
      </header>
      {sections.map((section) => (
        <section key={section} className={section ? "space-y-5 border-t border-slate-200 pt-6" : "space-y-5"}>
          <div className="space-y-2">
            <SkeletonBar width="w-64" height="h-6" />
            <SkeletonBar width="w-[34rem]" height="h-4" className="max-w-full bg-slate-100" />
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: section === 2 ? 3 : 6 }, (_, report) => (
              <article key={report} className="flex min-h-[220px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <SkeletonBar width="w-10" height="h-10" className="rounded-xl bg-cyan-50" />
                <SkeletonBar width="w-48" height="h-5" className="mt-4 max-w-full" />
                <SkeletonBar width="w-full" height="h-4" className="mt-2 bg-slate-100" />
                <SkeletonBar width="w-4/5" height="h-4" className="mt-1 bg-slate-100" />
                <SkeletonBar width="w-full" height="h-10" className="mt-auto rounded-xl" />
              </article>
            ))}
          </div>
        </section>
      ))}
      <span className="sr-only">Loading report categories…</span>
    </main>
  );
}
