import { Prisma, Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import GranteeArchiveExportMenu from "./GranteeArchiveExportMenu";
import ArchivedGranteesTable from "./ArchivedGranteesTable";

type HistoricalGranteeRecord = {
  id: string;
  yearLevel: string;
  school: string;
  dateEnrolled: Date;
  remarks: string | null;
  graduatedAt: Date | null;
  fullName: string | null;
  email: string | null;
};

export default async function GranteeRecordsPage({ searchParams }: {
  searchParams: Promise<{
    page?: string | string[];
    pageSize?: string | string[];
    status?: string | string[];
    q?: string | string[];
  }>;
}) {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const resolved = await searchParams;
  const rawQuery = Array.isArray(resolved.q) ? resolved.q[0] : resolved.q;
  const query = String(rawQuery || "").trim();
  const records = await prisma.$queryRaw<HistoricalGranteeRecord[]>(Prisma.sql`
      SELECT
        grantee."id",
        grantee."yearLevel",
        grantee."school",
        grantee."dateEnrolled",
        grantee."remarks",
        grantee."graduatedAt",
        account."fullName",
        account."email"
      FROM "public"."grantees" AS grantee
      INNER JOIN "public"."users" AS account ON account."id" = grantee."userId"
      WHERE grantee."status" = 'GRADUATED'::"GranteeStatus"
      ORDER BY grantee."graduatedAt" DESC NULLS LAST, grantee."updatedAt" DESC
    `);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8 pb-12">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">SKEAP records</span>
          <h1 className="mb-1.5 mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Graduated Scholars</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
            SKEAP scholars appear here when an administrator marks them as graduated. Revoked scholars are listed separately.
          </p>
        </div>
        <GranteeArchiveExportMenu />
      </header>

      <section className="flex w-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <ArchivedGranteesTable allRecords={records} initialQuery={query} />
      </section>
    </div>
  );
}
