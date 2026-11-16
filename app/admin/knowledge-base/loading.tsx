import { AdminPageHeaderSkeleton, SkeletonBar } from "../components/AdminSkeletonPrimitives";

export default function KnowledgeBaseRedirectLoading() {
  return (
    <main role="status" aria-label="Opening knowledge base" className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12">
      <AdminPageHeaderSkeleton titleWidth="w-56" subtitleWidth="w-[30rem]" />
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((card) => (
          <article key={card} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <SkeletonBar width="w-10" height="h-10" className="rounded-xl bg-cyan-50" />
            <SkeletonBar width="w-40" height="h-5" className="mt-4" />
            <SkeletonBar width="w-full" height="h-4" className="mt-3 bg-slate-100" />
            <SkeletonBar width="w-4/5" height="h-4" className="mt-2 bg-slate-100" />
          </article>
        ))}
      </section>
      <span className="sr-only">Opening the knowledge base…</span>
    </main>
  );
}
