import ExcelJS from "exceljs";
import { Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/logger";
import { createCsvResponse, parseReportDateRange, parseReportFormat } from "@/lib/report-export";

export const runtime = "nodejs";

type ExportFilter = "all_approved" | "grantees_only" | "kk_only";
type ExportClassification =
  | "In school Youth"
  | "Out of School Youth"
  | "Working Youth"
  | "Person w/ Disability"
  | "Indigenous People";
type MemberExportRow = {
  fullName: string;
  email: string;
  contactNumber: string;
  age: number;
  youthAgeGroup: string;
  youthClassification: string;
  workStatus: string;
  registeredSKVoter: string;
  reviewStatus: string;
  submittedAt: Date;
};

const COLUMNS = [
  { header: "Name", key: "fullName", width: 30 },
  { header: "Email", key: "email", width: 32 },
  { header: "Contact Number", key: "contactNumber", width: 20 },
  { header: "Age", key: "age", width: 10 },
  { header: "Age Group", key: "youthAgeGroup", width: 18 },
  { header: "Classification", key: "youthClassification", width: 24 },
  { header: "Work Status", key: "workStatus", width: 22 },
  { header: "SK Voter", key: "registeredSKVoter", width: 14 },
  { header: "Status", key: "reviewStatus", width: 14 },
  { header: "Submitted Date", key: "submittedAt", width: 20 },
] as const;
const CLASSIFICATIONS: ExportClassification[] = [
  "In school Youth",
  "Out of School Youth",
  "Working Youth",
  "Person w/ Disability",
  "Indigenous People",
];

function getFilename(filter: ExportFilter, classification?: ExportClassification) {
  const year = new Date().getFullYear();
  if (classification === "Out of School Youth") return `Out-of-School-Youth-Registry-${year}.xlsx`;
  if (filter === "grantees_only") return `SKEAP-Grantee-Profiles-${year}.xlsx`;
  if (filter === "kk_only") return `KK-Youth-Profiles-${year}.xlsx`;
  return `KK-Approved-Profiles-${year}.xlsx`;
}

function styleWorksheet(worksheet: ExcelJS.Worksheet) {
  const header = worksheet.getRow(1);
  header.height = 26;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F3D5C" } };
  header.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      if (rowNumber > 1) cell.alignment = { vertical: "middle", wrapText: true };
    });
  });

  worksheet.getColumn("submittedAt").numFmt = "mmm d, yyyy";
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNS.length },
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestedFilter = request.nextUrl.searchParams.get("filter") ?? "all_approved";
  if (!["all_approved", "grantees_only", "kk_only"].includes(requestedFilter)) {
    return NextResponse.json({ error: "Invalid member export filter." }, { status: 400 });
  }
  const filter = requestedFilter as ExportFilter;
  const format = parseReportFormat(request.nextUrl.searchParams.get("format"));
  const dateRange = parseReportDateRange(request.nextUrl.searchParams);
  if (!format) return NextResponse.json({ error: "Format must be xlsx or csv." }, { status: 400 });
  if (dateRange.error) return NextResponse.json({ error: dateRange.error }, { status: 400 });

  const requestedClassification = request.nextUrl.searchParams.get("classification");
  const requestedSkVoter = request.nextUrl.searchParams.get("skVoter");
  if (requestedSkVoter !== null && !["true", "false"].includes(requestedSkVoter)) {
    return NextResponse.json({ error: "Invalid SK voter export filter." }, { status: 400 });
  }
  if (
    requestedClassification &&
    !CLASSIFICATIONS.includes(requestedClassification as ExportClassification)
  ) {
    return NextResponse.json({ error: "Invalid member export classification." }, { status: 400 });
  }
  const classification = requestedClassification as ExportClassification | null;
  const granteeCondition = filter === "grantees_only"
    ? Prisma.sql`AND grantee."status" IN ('ACTIVE', 'PROBATIONARY')`
    : filter === "kk_only"
      ? Prisma.sql`AND (grantee."id" IS NULL OR grantee."status" NOT IN ('ACTIVE', 'PROBATIONARY'))`
      : Prisma.empty;
  const classificationCondition = classification
    ? Prisma.sql`AND LOWER(BTRIM(registration."youthClassification")) = LOWER(BTRIM(${classification}))`
    : Prisma.empty;
  const skVoterCondition = requestedSkVoter === "true"
    ? Prisma.sql`AND LOWER(BTRIM(registration."registeredSKVoter")) IN ('yes', 'true')`
    : requestedSkVoter === "false"
      ? Prisma.sql`AND LOWER(BTRIM(registration."registeredSKVoter")) NOT IN ('yes', 'true')`
      : Prisma.empty;
  const dateCondition = Prisma.sql`
    ${dateRange.startDate ? Prisma.sql`AND registration."submittedAt" >= ${dateRange.startDate}` : Prisma.empty}
    ${dateRange.endDateExclusive ? Prisma.sql`AND registration."submittedAt" < ${dateRange.endDateExclusive}` : Prisma.empty}
  `;

  try {
    const records = await prisma.$queryRaw<MemberExportRow[]>(Prisma.sql`
      SELECT
        registration."fullName",
        registration."email",
        registration."contactNumber",
        registration."age",
        registration."youthAgeGroup",
        registration."youthClassification",
        registration."workStatus",
        registration."registeredSKVoter",
        registration."reviewStatus",
        registration."submittedAt"
      FROM "public"."kk_profiling_registrations" AS registration
      LEFT JOIN "public"."users" AS account ON account."id" = registration."userId"
      LEFT JOIN "public"."grantees" AS grantee ON grantee."userId" = account."id"
      WHERE registration."reviewStatus" = 'Approved'
      ${granteeCondition}
      ${classificationCondition}
      ${skVoterCondition}
      ${dateCondition}
      ORDER BY registration."submittedAt" DESC
    `);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SKonnect";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet("Approved Profiles");
    worksheet.columns = [...COLUMNS];
    worksheet.addRows(records);
    styleWorksheet(worksheet);

    logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "RECORDS_EXPORTED",
      resource: "kk_profiling_registrations",
      metadata: {
        recordCount: records.length,
        filters: {
          reviewStatus: "Approved",
          profileType: filter,
          classification: classification ?? null,
          skVoter: requestedSkVoter,
          startDate: dateRange.startDate?.toISOString() ?? null,
          endDate: dateRange.endDateExclusive?.toISOString() ?? null,
        },
      },
    });

    const filename = getFilename(filter, classification ?? undefined);
    if (format === "csv") return createCsvResponse(records, COLUMNS, filename);

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to export member profiles:", error);
    return NextResponse.json({ error: "Failed to generate member profile report." }, { status: 500 });
  }
}
