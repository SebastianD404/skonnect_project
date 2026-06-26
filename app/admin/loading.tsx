export default function AdminLoading() {
  return (
    <div className="flex-1 px-8 py-10">
      <div className="animate-pulse space-y-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-100">
              <div className="h-5 w-5 rounded-full border-4 border-slate-300 border-t-[#0F3D5C]" />
            </div>
            <div className="space-y-2">
              <div className="h-3.5 w-40 rounded-full bg-slate-200" />
              <div className="h-5 w-72 rounded-full bg-slate-200" />
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <div className="h-36 rounded-[2rem] bg-slate-100" />
            <div className="h-36 rounded-[2rem] bg-slate-100" />
            <div className="h-36 rounded-[2rem] bg-slate-100" />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
          <div className="h-72 rounded-[2rem] bg-slate-100" />
          <div className="h-72 rounded-[2rem] bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
