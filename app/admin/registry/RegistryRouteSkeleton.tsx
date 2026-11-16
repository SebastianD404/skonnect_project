import { AdminTableCardSkeleton, SkeletonBar } from "../components/AdminSkeletonPrimitives";

export default function RegistryRouteSkeleton() {
  return (
    <main role="status" aria-label="Loading youth registry" className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 pb-12 sm:gap-8">
      <header className="space-y-2">
        <SkeletonBar width="w-36" height="h-3" className="rounded-full bg-cyan-900/10" />
        <SkeletonBar width="w-72" height="h-8" />
        <SkeletonBar width="w-[36rem]" height="h-4" className="max-w-full bg-slate-100" />
      </header>
      <section className="grid gap-3 sm:gap-5 md:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)]">
        <SkeletonBar width="w-full" height="h-11" className="rounded-xl" />
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((filter) => (
            <SkeletonBar key={filter} width="w-full" height="h-10" className="rounded-xl" />
          ))}
        </div>
      </section>
      <AdminTableCardSkeleton columns={6} rowCount={5} statusColumns={[3]} actionSlots={1} minTableWidth="min-w-[900px]" />
      <span className="sr-only">Loading registry records…</span>
    </main>
  );
}
