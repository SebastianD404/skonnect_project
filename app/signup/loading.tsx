export default function SignupLoading() {
  return (
    <main
      aria-label="Loading sign-up page"
      className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,61,92,0.08),_transparent_35%),linear-gradient(180deg,#f7f9fc_0%,#f4f7fb_100%)] px-4 py-10"
    >
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col items-center justify-center gap-8">
        <div aria-hidden="true" className="flex animate-pulse items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-slate-200" />
          <div className="space-y-2">
            <div className="h-5 w-28 rounded bg-slate-200" />
            <div className="h-4 w-48 rounded bg-slate-100" />
          </div>
        </div>
        <section className="w-full max-w-[430px] animate-pulse rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_28px_70px_rgba(15,61,92,0.10)] sm:p-8">
          <div className="mx-auto h-8 w-56 rounded bg-slate-200" />
          <div className="mx-auto mt-3 h-4 w-64 max-w-full rounded bg-slate-100" />
          <div className="mt-8 space-y-5">
            <div className="space-y-2">
              <div className="h-4 w-16 rounded bg-slate-200" />
              <div className="h-12 rounded-2xl bg-slate-100" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-20 rounded bg-slate-200" />
              <div className="h-12 rounded-2xl bg-slate-100" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-slate-200" />
              <div className="h-12 rounded-2xl bg-slate-100" />
            </div>
            <div className="h-12 rounded-2xl bg-slate-200" />
          </div>
        </section>
      </div>
    </main>
  );
}
