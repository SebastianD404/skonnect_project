import { SkeletonBar } from "../components/AdminSkeletonPrimitives";

const sectionRows = [0, 1, 2, 3];

export default function SettingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 sm:gap-8">
      <main role="status" aria-label="Loading settings" className="min-h-screen bg-[#F8FBFF]">
        <div className="mx-auto max-w-5xl px-4 pb-8 sm:px-6">
          <header className="border-b border-slate-200 py-8">
            <SkeletonBar width="w-44" height="h-3" className="rounded-full bg-cyan-900/10" />
            <SkeletonBar width="w-72" height="h-10 sm:h-12" className="mt-3 max-w-full" />
            <SkeletonBar width="w-[34rem]" height="h-4" className="mt-3 max-w-full bg-slate-100" />
          </header>

      <div aria-hidden="true" className="divide-y divide-slate-200">
        <section className="grid grid-cols-1 gap-8 py-8 md:grid-cols-3">
          <div className="space-y-2">
            <SkeletonBar width="w-28" height="h-4" />
            <SkeletonBar width="w-full" height="h-12" className="bg-slate-100" />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:col-span-2">
            {[0, 1].map((field) => (
              <div key={field} className="space-y-2">
                <SkeletonBar width="w-24" height="h-3" />
                <SkeletonBar width="w-full" height="h-11" className="rounded-lg" />
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-8 py-8 md:grid-cols-3">
          <div className="space-y-3">
            <SkeletonBar width="w-40" height="h-4" />
            <SkeletonBar width="w-full" height="h-16" className="bg-slate-100" />
            <SkeletonBar width="w-full" height="h-20" className="rounded-xl bg-sky-50" />
          </div>
          <div className="space-y-4 md:col-span-2">
            {[0, 1].map((card) => (
              <article key={card} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="space-y-2">
                    <SkeletonBar width="w-40" height="h-4" />
                    <SkeletonBar width="w-16" height="h-5" className="rounded-full bg-emerald-50" />
                  </div>
                  <SkeletonBar width="w-8" height="h-8" className="rounded-lg bg-slate-100" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[0, 1].map((field) => (
                    <div key={field} className="space-y-2">
                      <SkeletonBar width="w-28" height="h-3" />
                      <SkeletonBar width="w-full" height="h-10" className="rounded-lg" />
                    </div>
                  ))}
                </div>
              </article>
            ))}
            <SkeletonBar width="w-full" height="h-11" className="rounded-xl bg-slate-50" />
          </div>
        </section>

        {sectionRows.map((section) => (
          <section key={section} className="grid grid-cols-1 gap-8 py-8 md:grid-cols-3">
            <div className="space-y-2">
              <SkeletonBar width="w-36" height="h-4" />
              <SkeletonBar width="w-full" height="h-12" className="bg-slate-100" />
            </div>
            <div className="space-y-3 md:col-span-2">
              {section === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[0, 1, 2].map((field) => (
                      <div key={field} className="space-y-2">
                        <SkeletonBar width="w-28" height="h-3" />
                        <SkeletonBar width="w-full" height="h-10" className="rounded-lg" />
                      </div>
                    ))}
                  </div>
                  <SkeletonBar width="w-32" height="h-9" className="ml-auto mt-4 rounded-lg" />
                </div>
              ) : section === 1 ? (
                <div className="space-y-3">
                  {sectionRows.slice(0, 2).map((item) => (
                    <div key={item} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                      <div className="space-y-2">
                        <SkeletonBar width="w-40" height="h-4" />
                        <SkeletonBar width="w-56" height="h-3" className="bg-slate-100" />
                      </div>
                      <SkeletonBar width="w-12" height="h-7" className="rounded-full bg-cyan-50" />
                    </div>
                  ))}
                </div>
              ) : section === 2 ? (
                <div className="space-y-3">
                  <SkeletonBar width="w-32" height="h-3" />
                  <SkeletonBar width="w-full" height="h-11" className="rounded-lg" />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {sectionRows.map((option) => (
                    <div key={option} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                      <SkeletonBar width="w-4" height="h-4" className="rounded-sm bg-slate-100" />
                      <SkeletonBar width="w-32" height="h-4" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ))}
        <section className="grid grid-cols-1 gap-8 border-t border-slate-200 py-8 md:grid-cols-3">
          <SkeletonBar width="w-28" height="h-4" />
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2">
            <SkeletonBar width="w-40" height="h-4" />
            <SkeletonBar width="w-12" height="h-7" className="rounded-full bg-cyan-50" />
          </div>
        </section>
        <footer className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-slate-200 bg-slate-50/90 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6">
          <div className="flex justify-end">
            <SkeletonBar width="w-32" height="h-10" className="rounded-xl" />
          </div>
        </footer>
      </div>
      <span className="sr-only">Loading account and SKEAP settings…</span>
        </div>
      </main>
    </div>
  );
}
