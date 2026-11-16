import { SkeletonBar } from "../../../components/AdminSkeletonPrimitives";

export default function SubmissionDocumentLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 sm:gap-8">
      <main role="status" aria-label="Loading submission document preview" className="flex min-h-screen flex-col bg-slate-100">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <SkeletonBar width="w-10" height="h-10" className="shrink-0 rounded-xl bg-sky-50" />
            <div className="min-w-0 space-y-2">
              <SkeletonBar width="w-36" height="h-2.5" className="rounded-full bg-slate-100" />
              <SkeletonBar width="w-56" height="h-4" className="max-w-full" />
            </div>
          </div>
          <SkeletonBar width="w-24" height="h-10" className="shrink-0 rounded-xl" />
        </header>
        <section className="flex flex-1 items-center justify-center p-4 sm:p-8">
          <div className="flex h-[calc(100vh-130px)] min-h-[360px] w-full max-w-6xl items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SkeletonBar width="w-full" height="h-full" className="rounded-none bg-slate-100" />
          </div>
        </section>
        <span className="sr-only">Loading document preview…</span>
      </main>
    </div>
  );
}
