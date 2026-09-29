"use client";

import { usePathname } from "next/navigation";

function Placeholder({ className }: { className: string }) {
  return <div className={`bg-slate-200 ${className}`} />;
}

function MetricCardSkeleton() {
  return (
    <div className="group flex min-h-[140px] w-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-3 w-32 animate-pulse rounded-md bg-slate-200" />
        </div>
        <div className="h-4 w-4 animate-pulse rounded-sm bg-slate-200" />
      </div>
      <div className="mt-auto flex items-baseline gap-2.5">
        <div className="h-10 w-16 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-6 w-28 animate-pulse rounded-md bg-slate-200" />
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="border-b border-slate-200 py-1">
      <div className="flex items-center gap-2 px-8">
        <Placeholder className="h-10 flex-1 rounded-full bg-white ring-1 ring-slate-200" />
        <Placeholder className="h-9 w-20 rounded-full bg-white ring-1 ring-slate-200" />
      </div>
    </div>
  );
}

function DashboardHeader({
  titleLines = 1,
  operationalSnapshot = false,
  metricCount = 4,
}: {
  titleLines?: number;
  operationalSnapshot?: boolean;
  metricCount?: number;
}) {
  return (
    <>
      <TopBar />
      <div className="px-8 pb-2 pt-6">
        <Placeholder className="mb-3 h-3 w-44 rounded-full" />
        <div className={`flex flex-col ${operationalSnapshot ? "gap-0" : "gap-4 lg:flex-row lg:items-end lg:justify-between"}`}>
          <div className="flex-1 space-y-2">
            {Array.from({ length: titleLines }, (_, index) => (
              <Placeholder key={index} className={`h-9 max-w-full rounded-md ${index === 0 ? "w-3/4" : "w-1/2"}`} />
            ))}
          </div>
          {!operationalSnapshot && (
            <div className="flex w-fit gap-1 rounded-full border border-slate-200 bg-white p-1">
              {Array.from({ length: 4 }, (_, index) => (
                <Placeholder key={index} className="h-9 w-16 rounded-full" />
              ))}
            </div>
          )}
        </div>
      </div>
      {operationalSnapshot ? (
        <div className="px-8 py-2">
          <div className={`mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 ${metricCount === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
            {Array.from({ length: metricCount }, (_, index) => <MetricCardSkeleton key={index} />)}
          </div>
        </div>
      ) : (
        <div className="px-8 py-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between">
                  <Placeholder className="h-11 w-11 rounded-2xl bg-slate-100" />
                  <Placeholder className="h-6 w-12 rounded-full bg-emerald-50" />
                </div>
                <Placeholder className="mt-5 h-2.5 w-28 rounded-full" />
                <div className="mt-2 flex items-end gap-3">
                  <Placeholder className="h-8 w-12 rounded-md" />
                  <Placeholder className="mb-1 h-2.5 w-24 rounded-full bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function TableRows({ rowCount = 5 }: { rowCount?: number }) {
  return (
    <div className="min-w-[760px]">
      <div className="grid grid-cols-6 gap-6 border-b border-slate-200 bg-slate-50 px-6 py-4">
        {Array.from({ length: 6 }, (_, index) => (
          <Placeholder key={index} className="h-3 w-20 max-w-full rounded-full" />
        ))}
      </div>
      {Array.from({ length: rowCount }, (_, row) => (
        <div key={row} className="grid grid-cols-6 items-center gap-6 border-b border-slate-100 px-6 py-5 last:border-0">
          {Array.from({ length: 6 }, (_, column) => (
            <div key={column} className="space-y-2">
              <Placeholder className={`h-3 rounded-full ${column === 0 ? "w-28" : "w-20"}`} />
              {(column < 2) && <Placeholder className="h-2.5 w-24 max-w-full rounded-full bg-slate-100" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function FilterBar() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Placeholder className="h-10 min-w-[220px] flex-1 rounded-full bg-white ring-1 ring-slate-200" />
      {Array.from({ length: 3 }, (_, index) => (
        <Placeholder key={index} className="h-9 w-20 rounded-full" />
      ))}
    </div>
  );
}

function InquirySkeleton() {
  return (
    <div className="animate-pulse">
      <DashboardHeader titleLines={2} />
      <section className="mx-8 mt-8 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Placeholder className="h-3 w-36 rounded-full bg-slate-100" />
            <Placeholder className="h-7 w-60 rounded-md" />
          </div>
          <FilterBar />
        </div>
        <div className="overflow-x-auto"><TableRows /></div>
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <DashboardHeader operationalSnapshot />
      <div className="flex flex-col gap-6 px-8 py-8 lg:grid lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <section key={index} className="min-h-72 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Placeholder className="h-3 w-32 rounded-full" />
            <Placeholder className="mt-2 h-5 w-40 rounded-md" />
            <div className="mt-8 space-y-4">
              {Array.from({ length: 3 }, (_, row) => <Placeholder key={row} className="h-10 w-full rounded-xl bg-slate-100" />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function GranteesSkeleton() {
  return (
    <div className="animate-pulse">
      <DashboardHeader operationalSnapshot metricCount={4} />
      <div className="space-y-6 px-8 py-8">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <Placeholder className="h-3 w-32 rounded-full" />
          <Placeholder className="mt-3 h-9 w-2/3 max-w-full rounded-md" />
          <Placeholder className="mt-3 h-3 w-3/4 max-w-full rounded-full bg-slate-100" />
        </section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5"><FilterBar /></div>
          <div className="overflow-x-auto"><TableRows /></div>
        </section>
      </div>
    </div>
  );
}

function ListSkeleton({ showStats = false }: { showStats?: boolean }) {
  return (
    <div className="animate-pulse mx-auto max-w-7xl space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <Placeholder className="h-3 w-28 rounded-full" />
        <Placeholder className="mt-3 h-9 w-2/3 max-w-full rounded-md" />
        <Placeholder className="mt-3 h-3 w-3/4 max-w-full rounded-full bg-slate-100" />
      </section>
      {showStats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <section key={index} className="h-36 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <Placeholder className="h-2.5 w-28 rounded-full" />
              <Placeholder className="mt-4 h-9 w-16 rounded-md" />
              <Placeholder className="mt-3 h-2.5 w-3/4 rounded-full bg-slate-100" />
            </section>
          ))}
        </div>
      )}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5"><FilterBar /></div>
        <div className="overflow-x-auto"><TableRows /></div>
      </section>
    </div>
  );
}

function SkeapApplicationsSkeleton() {
  return (
    <div className="animate-pulse min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1480px] gap-6 px-6 py-8">
        <main className="flex-1 space-y-6">
          <header className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <Placeholder className="h-3 w-36 rounded-full" />
            <Placeholder className="mt-3 h-10 w-2/3 max-w-full rounded-md" />
            <Placeholder className="mt-3 h-3 w-3/4 max-w-full rounded-full bg-slate-100" />
          </header>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <section key={index} className={`rounded-2xl border bg-white p-5 shadow-sm ${index === 0 ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"}`}>
                <Placeholder className="h-9 w-9 rounded-xl bg-slate-50" />
                <Placeholder className="mt-4 h-2.5 w-28 rounded-full" />
                <div className="mt-2 flex items-end gap-2">
                  <Placeholder className="h-8 w-8 rounded-md" />
                  <Placeholder className="mb-1 h-2.5 w-16 rounded-full bg-slate-100" />
                </div>
              </section>
            ))}
          </div>
          <section className="mt-6 flex min-h-[500px] w-full flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Placeholder className="mb-6 h-20 w-20 rounded-full border border-emerald-100 bg-emerald-50" />
            <Placeholder className="mb-2 h-6 w-56 max-w-full rounded-md" />
            <Placeholder className="mb-8 h-3 w-80 max-w-full rounded-full bg-slate-100" />
            <Placeholder className="h-10 w-48 rounded-xl bg-white ring-1 ring-slate-200" />
          </section>
        </main>
      </div>
    </div>
  );
}

function SkeapWaitlistSkeleton() {
  return (
    <main className="animate-pulse min-h-full space-y-6 p-6 lg:p-10">
      <header className="flex flex-col items-center justify-between gap-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:p-8">
        <div className="w-full max-w-lg flex-shrink-0 lg:w-[32rem]">
          <Placeholder className="h-3 w-44 rounded-full" />
          <Placeholder className="mt-3 h-10 w-2/3 max-w-full rounded-md" />
          <Placeholder className="mt-3 h-3 w-full rounded-full bg-slate-100" />
          <Placeholder className="mt-2 h-3 w-4/5 rounded-full bg-slate-100" />
        </div>
        <div className="flex w-full items-center gap-3 lg:w-auto">
          <Placeholder className="h-7 w-24 rounded-md" />
          <Placeholder className="h-10 w-32 rounded-lg bg-slate-100" />
        </div>
      </header>
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <Placeholder className="h-3 w-16 rounded-full" />
            <Placeholder className="mt-2 h-6 w-52 rounded-md" />
          </div>
          <Placeholder className="h-9 w-24 rounded-full bg-white ring-1 ring-slate-200" />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-5 gap-6 bg-slate-50 px-6 py-4">
              {Array.from({ length: 5 }, (_, index) => <Placeholder key={index} className="h-3 w-24 rounded-full" />)}
            </div>
            {Array.from({ length: 5 }, (_, row) => (
              <div key={row} className="grid grid-cols-5 items-center gap-6 border-t border-slate-100 px-6 py-5">
                <Placeholder className="h-6 w-10 rounded-md" />
                <div className="space-y-2">
                  <Placeholder className="h-3 w-32 rounded-full" />
                  <Placeholder className="h-2.5 w-40 rounded-full bg-slate-100" />
                </div>
                <div className="space-y-2">
                  <Placeholder className="h-3 w-28 rounded-full" />
                  <Placeholder className="h-2.5 w-24 rounded-full bg-slate-100" />
                </div>
                <Placeholder className="h-3 w-20 rounded-full" />
                <Placeholder className="ml-auto h-9 w-36 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function SubmissionsSkeleton() {
  return (
    <div className="animate-pulse min-h-screen bg-[#F8FBFF] text-slate-950">
      <div className="px-8 py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <Placeholder className="h-3 w-40 rounded-full" />
                <Placeholder className="mt-3 h-10 w-80 max-w-full rounded-md" />
                <Placeholder className="mt-3 h-3 w-full max-w-xl rounded-full bg-slate-100" />
              </div>
              <div className="flex min-w-44 flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-6 py-5 shadow-sm">
                <Placeholder className="h-3 w-32 rounded-full bg-slate-100" />
                <Placeholder className="h-10 w-14 rounded-md" />
                <Placeholder className="h-9 w-36 rounded-full bg-slate-200" />
              </div>
            </div>
          </header>
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <Placeholder className="h-3 w-40 rounded-full" />
                <Placeholder className="mt-2 h-7 w-64 max-w-full rounded-md" />
              </div>
              <Placeholder className="h-11 w-full max-w-sm rounded-full bg-slate-50" />
            </div>
            <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
              {Array.from({ length: 4 }, (_, index) => <Placeholder key={index} className="h-9 w-40 max-w-full rounded-lg bg-slate-100" />)}
            </div>
            <div className="mt-6 overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-6 gap-4 bg-slate-50 px-4 py-4">
                  {Array.from({ length: 6 }, (_, index) => <Placeholder key={index} className="h-3 w-20 rounded-full" />)}
                </div>
                {Array.from({ length: 5 }, (_, row) => (
                  <div key={row} className="grid grid-cols-6 items-center gap-4 border-t border-slate-200 px-4 py-5">
                    {Array.from({ length: 6 }, (_, column) => (
                      <div key={column} className="space-y-2">
                        <Placeholder className={`h-3 rounded-full ${column === 0 ? "w-28" : "w-20"}`} />
                        {(column === 0 || column === 2) && <Placeholder className="h-2.5 w-24 rounded-full bg-slate-100" />}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="animate-pulse mx-auto max-w-[1480px] px-6 py-10">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Placeholder className="h-3 w-40 rounded-full" />
        <Placeholder className="mt-3 h-10 w-2/3 max-w-full rounded-md" />
        <Placeholder className="mt-3 h-3 w-3/4 max-w-full rounded-full bg-slate-100" />
        <div className="mt-10 grid gap-8 xl:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-8">
            {Array.from({ length: 4 }, (_, index) => (
              <section key={index} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6">
                <Placeholder className="h-4 w-36 rounded-full" />
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Placeholder className="h-12 rounded-2xl bg-white ring-1 ring-slate-200" />
                  <Placeholder className="h-12 rounded-2xl bg-white ring-1 ring-slate-200" />
                </div>
              </section>
            ))}
          </div>
          <section className="min-h-64 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6">
            <Placeholder className="h-4 w-32 rounded-full" />
            <div className="mt-6 space-y-4">
              {Array.from({ length: 4 }, (_, index) => <Placeholder key={index} className="h-12 rounded-2xl bg-white ring-1 ring-slate-200" />)}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function BroadcastSkeleton() {
  return (
    <div className="animate-pulse mx-auto max-w-4xl py-4">
      <div className="mb-8">
        <Placeholder className="mb-4 h-12 w-12 rounded-2xl bg-[#0F3D5C]/10" />
        <Placeholder className="h-3 w-28 rounded-full" />
        <Placeholder className="mt-3 h-10 w-2/3 max-w-full rounded-md" />
        <Placeholder className="mt-3 h-3 w-3/4 max-w-full rounded-full bg-slate-100" />
      </div>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
          <Placeholder className="h-4 w-24 rounded-full" />
          <Placeholder className="mt-3 h-4 w-56 max-w-full rounded-full bg-slate-100" />
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Placeholder className="h-12 rounded-xl bg-white" />
            <Placeholder className="h-12 rounded-xl bg-white" />
          </div>
        </div>
        <div className="mt-8 space-y-6">
          <Placeholder className="h-12 rounded-2xl bg-slate-50" />
          <Placeholder className="h-40 rounded-2xl bg-slate-50" />
          <Placeholder className="h-11 w-36 rounded-xl bg-[#0F3D5C]/10" />
        </div>
      </section>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse mx-auto max-w-7xl space-y-6 px-6 py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Placeholder className="h-3 w-24 rounded-full" />
        <Placeholder className="mt-3 h-9 w-1/2 max-w-full rounded-md" />
      </section>
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section className="min-h-72 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Placeholder className="h-24 w-24 rounded-full" />
          <Placeholder className="mt-6 h-5 w-2/3 rounded-md" />
          <Placeholder className="mt-3 h-3 w-full rounded-full bg-slate-100" />
        </section>
        <section className="min-h-96 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Placeholder className="h-5 w-1/3 rounded-md" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 8 }, (_, index) => <Placeholder key={index} className="h-12 rounded-xl bg-slate-100" />)}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AdminLoading() {
  const pathname = usePathname() ?? "/admin";

  if (pathname === "/admin" || pathname === "/admin/") return <DashboardSkeleton />;
  if (pathname.startsWith("/admin/inquiries")) return <InquirySkeleton />;
  if (pathname.startsWith("/admin/skeap-applications")) return <SkeapApplicationsSkeleton />;
  if (pathname.startsWith("/admin/skeap-waitlist")) return <SkeapWaitlistSkeleton />;
  if (pathname.startsWith("/admin/submissions")) return <SubmissionsSkeleton />;
  if (pathname === "/admin/grantees") return <GranteesSkeleton />;
  if (pathname.startsWith("/admin/grantees/")) return <DetailSkeleton />;
  if (pathname.startsWith("/admin/settings")) return <SettingsSkeleton />;
  if (pathname.startsWith("/admin/members")) return <ListSkeleton showStats />;
  if (pathname.startsWith("/admin/accounting")) return <ListSkeleton />;
  if (pathname.startsWith("/admin/broadcast")) return <BroadcastSkeleton />;

  return <ListSkeleton />;
}
