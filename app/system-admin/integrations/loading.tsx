const integrations = [0, 1, 2];

function Placeholder({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-slate-100 ${className}`} />;
}

function IntegrationCardSkeleton() {
  return (
    <section
      aria-hidden="true"
      className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Placeholder className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Placeholder className="h-4 w-40 max-w-full" />
            <Placeholder className="h-3 w-64 max-w-full" />
            <Placeholder className="h-3 w-52 max-w-full" />
          </div>
        </div>
        <Placeholder className="mt-1 h-3 w-20 shrink-0 rounded-full" />
      </div>
      <div className="mt-5 border-t border-slate-100 pt-4">
        <Placeholder className="h-3 w-52 max-w-full" />
      </div>
    </section>
  );
}

export default function IntegrationsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading API integrations"
      className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 sm:gap-8"
    >
      <header>
        <Placeholder className="h-3 w-56" />
        <Placeholder className="mt-2 h-7 w-56 max-w-full" />
        <Placeholder className="mt-2 h-4 w-[min(48rem,100%)]" />
        <Placeholder className="mt-1 h-4 w-72 max-w-full" />
      </header>

      <div
        aria-hidden="true"
        className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
      >
        <Placeholder className="mt-0.5 h-4 w-4 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Placeholder className="h-3 w-full max-w-4xl" />
          <Placeholder className="h-3 w-2/3 max-w-2xl" />
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
        {integrations.map((integration) => (
          <IntegrationCardSkeleton key={integration} />
        ))}
      </div>
      <span className="sr-only">Checking integration configuration and connection status…</span>
    </div>
  );
}
