import ExcelJS from "exceljs";
import { GranteeStatus, Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createCsvResponse, parseReportDateRange, parseReportFormat } from "@/lib/report-export";
import { addReportHeading, styleReportTable } from "@/lib/excel-report-style";

export const runtime = "nodejs";

type ArchivedGranteeExportRow = {
  name: string | null;
  school: string;
  yearLevel: string;
  dateEnrolled: Date;
  endDate: Date | null;
  remarks: string | null;
};

const COLUMNS = [
  { header: "Name", key: "name", width: 32 },
  { header: "Status", key: "status", width: 16 },
  { header: "School", key: "school", width: 34 },
  { header: "Semester/Year", key: "yearLevel", width: 22 },
  { header: "Enrolled Date", key: "dateEnrolled", width: 18 },
  { header: "End Date", key: "endDate", width: 18 },
  { header: "Remarks", key: "remarks", width: 48 },
] as const;

function styleWorksheet(worksheet: ExcelJS.Worksheet) {
  addReportHeading(worksheet, worksheet.name);
  styleReportTable(worksheet, { headerRow: 5 });
  worksheet.getColumn("dateEnrolled").numFmt = "mmm d, yyyy";
  worksheet.getColumn("endDate").numFmt = "mmm d, yyyy";
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestedStatus = request.nextUrl.searchParams.get("status") ?? "graduated";
  if (requestedStatus !== "graduated") {
    return NextResponse.json({ error: "Invalid grantee archive report status." }, { status: 400 });
  }
  const format = parseReportFormat(request.nextUrl.searchParams.get("format"));
  const dateRange = parseReportDateRange(request.nextUrl.searchParams);
  if (!format) return NextResponse.json({ error: "Format must be xlsx or csv." }, { status: 400 });
  if (dateRange.error) return NextResponse.json({ error: dateRange.error }, { status: 400 });

  try {
    const records = await prisma.$queryRaw<ArchivedGranteeExportRow[]>(Prisma.sql`
      SELECT
        account."fullName" AS "name",
        grantee."school",
        grantee."yearLevel",
        grantee."dateEnrolled",
        grantee."graduatedAt" AS "endDate",
        grantee."remarks"
      FROM "public"."grantees" AS grantee
      INNER JOIN "public"."users" AS account ON account."id" = grantee."userId"
      WHERE grantee."status"::text = ${GranteeStatus.GRADUATED}
      ${dateRange.startDate ? Prisma.sql`AND grantee."graduatedAt" >= ${dateRange.startDate}` : Prisma.empty}
      ${dateRange.endDateExclusive ? Prisma.sql`AND grantee."graduatedAt" < ${dateRange.endDateExclusive}` : Prisma.empty}
      ORDER BY grantee."graduatedAt" DESC NULLS LAST, grantee."updatedAt" DESC
    `);

    const exportRows = records.map((record) => ({
      name: record.name ?? "Unknown scholar",
      status: "Graduated",
      school: record.school,
      yearLevel: record.yearLevel,
      dateEnrolled: record.dateEnrolled,
      endDate: record.endDate,
      remarks: record.remarks ?? "",
    }));
    if (format === "csv") {
      return createCsvResponse(exportRows, COLUMNS, `SKEAP-Graduated-Grantees-${new Date().getFullYear()}.xlsx`);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SKonnect";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet("Graduated Scholars");
    worksheet.columns = [...COLUMNS];
    worksheet.addRows(exportRows);
    styleWorksheet(worksheet);

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="SKEAP-Graduated-Grantees-${new Date().getFullYear()}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to export grantee archive report:", error);
    return NextResponse.json({ error: "Failed to generate grantee archive report." }, { status: 500 });
  }
}
