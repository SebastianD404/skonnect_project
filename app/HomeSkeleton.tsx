export default function HomeSkeleton() {
  return (
    <main
      className="min-h-screen overflow-hidden bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] pt-12 md:pt-24"
      role="status"
      aria-label="Loading home page"
    >
      <div className="mx-auto max-w-7xl px-6">
        <section className="grid min-h-[480px] grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-8 motion-safe:animate-pulse">
            <div className="h-10 w-72 rounded-full bg-sky-100" />
            <div className="space-y-3">
              <div className="h-14 w-full max-w-2xl rounded-xl bg-slate-200" />
              <div className="h-14 w-3/4 max-w-xl rounded-xl bg-slate-200" />
            </div>
            <div className="space-y-3">
              <div className="h-5 w-full max-w-xl rounded bg-slate-100" />
              <div className="h-5 w-5/6 max-w-lg rounded bg-slate-100" />
            </div>
            <div className="flex flex-wrap gap-4 pt-4">
              <div className="h-12 w-48 rounded-2xl bg-slate-200" />
              <div className="h-12 w-56 rounded-2xl border-2 border-slate-200 bg-white/60" />
            </div>
            <div className="grid max-w-md grid-cols-3 gap-6 pt-4">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="space-y-2 text-center">
                  <div className="mx-auto h-8 w-16 rounded bg-slate-200" />
                  <div className="mx-auto h-3 w-20 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
          <div className="hidden h-96 animate-pulse rounded-3xl border border-white/60 bg-gradient-to-br from-slate-100 to-slate-200 shadow-xl lg:block lg:h-[480px]" />
        </section>
      </div>
    </main>
  );
}
