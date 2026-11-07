const chunks = [0, 1, 2, 3];
const contentLines = [0, 1, 2];

function Placeholder({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-slate-100 ${className}`} />;
}

function FilterButtonSkeleton({ selected = false }: { selected?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`flex h-7 items-center rounded-full border px-3 ${
        selected ? "border-blue-200 bg-blue-100" : "border-slate-200 bg-white"
      }`}
    >
      <Placeholder className={`h-3 ${selected ? "w-10 bg-blue-200" : "w-12"}`} />
    </div>
  );
}

function KnowledgeChunkSkeleton() {
  return (
    <article
      aria-hidden="true"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Placeholder className="h-6 w-40 rounded-md" />
        <Placeholder className="h-6 w-24 rounded-full" />
        <Placeholder className="h-6 w-20 rounded-full" />
        <Placeholder className="ml-auto h-4 w-28" />
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white">
          <Placeholder className="h-4 w-4 rounded-sm" />
        </div>
      </div>
      <div className="space-y-2">
        {contentLines.map((line) => (
          <Placeholder
            key={line}
            className={`h-3.5 ${line === 2 ? "w-3/5" : "w-full"}`}
          />
        ))}
      </div>
    </article>
  );
}

export default function KnowledgeBaseLoading() {
  return (
    <div
      role="status"
      aria-label="Loading knowledge base"
      className="mx-auto w-full max-w-7xl"
    >
      <header className="mb-6">
        <Placeholder className="h-3 w-24" />
        <Placeholder className="mt-2 h-7 w-72 max-w-full" />
        <Placeholder className="mt-3 h-4 w-[min(42rem,100%)]" />
      </header>

      <section aria-hidden="true">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex h-10 w-full items-center rounded-xl border border-slate-200 bg-white px-4 shadow-sm sm:max-w-xl">
            <Placeholder className="h-3 w-2/3 max-w-80" />
          </div>
          <Placeholder className="h-4 w-40" />
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-8 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <Placeholder className="h-3 w-16" />
            <div className="flex h-9 w-[250px] max-w-[70vw] items-center justify-between rounded-lg border border-slate-200 bg-white px-3">
              <Placeholder className="h-3 w-28" />
              <Placeholder className="h-3 w-3 rounded-sm" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Placeholder className="h-3 w-16" />
            {chunks.map((language) => (
              <FilterButtonSkeleton key={language} selected={language === 0} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {chunks.map((chunk) => (
            <KnowledgeChunkSkeleton key={chunk} />
          ))}
        </div>
      </section>
      <span className="sr-only">Loading knowledge articles…</span>
    </div>
  );
}
