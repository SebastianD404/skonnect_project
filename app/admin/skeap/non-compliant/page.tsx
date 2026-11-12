import { Role } from "@prisma/client";
import { formatDate } from "@/lib/utils";
import { requireRole } from "@/lib/auth";
import { getAcademicTermScheduleState } from "@/lib/academic-term-schedule";
import { normalizeAdminTablePageSize } from "@/lib/admin-pagination";
import { getNonCompliantGrantees } from "@/lib/non-compliant-grantees";
import AdminTablePaginationFooter from "../../AdminTablePaginationFooter";

export default async function NonCompliantGranteesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    pageSize?: string | string[];
    q?: string | string[];
  }>;
}) {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const resolved = await searchParams;
  const getParam = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
  const requestedPage = Number(getParam(resolved.page) || 1);
  const pageSize = normalizeAdminTablePageSize(Number(getParam(resolved.pageSize)));
  const query = String(getParam(resolved.q) || "").trim();
  const { window } = await getAcademicTermScheduleState();
  const semester = window.semester;
  const result = semester
    ? await getNonCompliantGrantees(semester, {
        page: Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1,
        pageSize,
        search: query,
      })
    : { records: [], totalCount: 0, page: 1, totalPages: 1 };
  const { records, totalCount, page } = result;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12">
      <header>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          SKEAP Management
        </span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Non-Compliant Grantees
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
          Active scholars with missing or rejected semester documents
          {semester ? ` for ${semester}` : ""}.
        </p>
      </header>

      <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Compliance review list</h2>
            <p className="text-xs text-slate-500">
              {semester ? `${totalCount.toLocaleString()} ${totalCount === 1 ? "scholar" : "scholars"} require attention` : "No active semester is configured"}
            </p>
          </div>
          {semester ? (
            <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
              {semester}
            </span>
          ) : null}
        </div>

        <form
          method="get"
          action="/admin/skeap/non-compliant"
          className="flex flex-col gap-2 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center"
        >
          <label htmlFor="non-compliant-search" className="sr-only">
            Search non-compliant scholars
          </label>
          <input
            id="non-compliant-search"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search name, email, school, or year level..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 sm:max-w-sm"
          />
          <input type="hidden" name="pageSize" value={pageSize} />
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0F3D5C] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0D2E47]"
          >
            Search
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3">Scholar</th>
                <th scope="col" className="px-5 py-3">School / Year Level</th>
                <th scope="col" className="px-5 py-3">Status</th>
                <th scope="col" className="px-5 py-3">Missing or Rejected Requirements</th>
                <th scope="col" className="px-5 py-3">Last Submission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {records.map((record) => (
                <tr key={record.id} className="align-top transition-colors hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-900">{record.fullName}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{record.email || "No email on file"}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div>{record.school}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{record.yearLevel}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                      {record.statusLabel}
                    </span>
                  </td>
                  <td className="max-w-md whitespace-normal px-5 py-4 text-slate-600">
                    {record.issues.join(", ")}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {record.submittedAt ? formatDate(record.submittedAt) : "—"}
                  </td>
                </tr>
              ))}
              {records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center text-sm text-slate-500">
                    {!semester
                      ? "Configure an academic semester to review grantee compliance."
                      : query
                        ? "No non-compliant scholars match your search."
                        : "No active scholars have missing or rejected submissions for this semester."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <AdminTablePaginationFooter
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          basePath="/admin/skeap/non-compliant"
        />
      </section>
    </div>
  );
}
