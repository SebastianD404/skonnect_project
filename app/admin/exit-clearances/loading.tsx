export default function ExitClearancesLoading() {
  return (
    <div className="flex w-full flex-col gap-6 pb-12" aria-hidden="true">
      <header className="space-y-2">
        <div className="h-3 w-36 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-full max-w-lg animate-pulse rounded bg-slate-200" />
      </header>

      <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex gap-2 border-b border-slate-100 p-4 sm:p-5">
          <div className="h-8 w-28 animate-pulse rounded-full bg-slate-200" />
          <div className="h-8 w-32 animate-pulse rounded-full bg-slate-200" />
        </div>
        <div className="overflow-hidden">
          <div className="h-11 animate-pulse bg-slate-800" />
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="grid h-[72px] grid-cols-6 items-center gap-4 border-b border-slate-100 px-4"
            >
              <div className="space-y-2">
                <div className="h-3.5 w-28 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
              <div className="h-6 w-28 animate-pulse rounded-full bg-slate-200" />
              <div className="ml-auto h-9 w-32 animate-pulse rounded-lg bg-slate-200" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
