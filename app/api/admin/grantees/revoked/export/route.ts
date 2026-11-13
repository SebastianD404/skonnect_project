import ExcelJS from "exceljs";
import { GranteeStatus, Role, SubmissionStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { formatDisplayName } from "@/lib/display-name";
import { logAuditEvent } from "@/lib/audit/logger";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createCsvResponse, parseReportDateRange, parseReportFormat } from "@/lib/report-export";
import { addReportHeading, styleReportTable } from "@/lib/excel-report-style";

export const runtime = "nodejs";

const COLUMNS = [
  { header: "Name", key: "fullName", width: 32 },
  { header: "Email", key: "email", width: 34 },
  { header: "Sitio", key: "sitio", width: 20 },
  { header: "Date Revoked", key: "dateRevoked", width: 20 },
  { header: "Reason for Revocation", key: "reason", width: 48 },
] as const;
const REVOCATION_REASON_FILTERS: Record<string, string> = {
  failing_grades: "fail",
  misconduct: "misconduct",
  moved_out_of_barangay: "moved out of barangay",
};

function styleWorksheet(worksheet: ExcelJS.Worksheet) {
  addReportHeading(worksheet, worksheet.name);
  styleReportTable(worksheet, { headerRow: 5 });
  worksheet.getColumn("dateRevoked").numFmt = "mmm d, yyyy";
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const format = parseReportFormat(request.nextUrl.searchParams.get("format"));
  const dateRange = parseReportDateRange(request.nextUrl.searchParams);
  const reasonFilter = request.nextUrl.searchParams.get("reason") ?? "all";
  const reasonSearchTerm = Object.prototype.hasOwnProperty.call(REVOCATION_REASON_FILTERS, reasonFilter)
    ? REVOCATION_REASON_FILTERS[reasonFilter]
    : undefined;
  if (!format) return NextResponse.json({ error: "Format must be xlsx or csv." }, { status: 400 });
  if (dateRange.error) return NextResponse.json({ error: dateRange.error }, { status: 400 });
  if (reasonFilter !== "all" && !reasonSearchTerm) {
    return NextResponse.json({ error: "Invalid revocation reason filter." }, { status: 400 });
  }

  try {
    const grantees = await prisma.grantee.findMany({
      where: {
        status: GranteeStatus.REMOVED,
        dateRemoved: {
          not: null,
          ...(dateRange.startDate ? { gte: dateRange.startDate } : {}),
          ...(dateRange.endDateExclusive ? { lt: dateRange.endDateExclusive } : {}),
        },
        submissions: { some: { status: SubmissionStatus.REMOVED } },
        ...(reasonSearchTerm
          ? {
              OR: [
                {
                  remarks: {
                    contains: reasonSearchTerm,
                    mode: "insensitive" as const,
                  },
                },
                {
                  submissions: {
                    some: {
                      status: SubmissionStatus.REMOVED,
                      reviewNotes: {
                        contains: reasonSearchTerm,
                        mode: "insensitive" as const,
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ dateRemoved: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        dateRemoved: true,
        remarks: true,
        user: {
          select: {
            fullName: true,
            email: true,
            kkProfile: {
              select: {
                firstName: true,
                middleName: true,
                lastName: true,
                purok: true,
              },
            },
          },
        },
        submissions: {
          where: { status: SubmissionStatus.REMOVED },
          orderBy: { reviewedAt: "desc" },
          take: 1,
          select: { reviewNotes: true },
        },
      },
    });

    const records = grantees.flatMap((grantee) => grantee.dateRemoved
      ? [{
          fullName: formatDisplayName(grantee.user.kkProfile, grantee.user.fullName),
          email: grantee.user.email,
          sitio: grantee.user.kkProfile?.purok ?? "",
          dateRevoked: grantee.dateRemoved,
          reason: grantee.remarks?.trim() || grantee.submissions[0]?.reviewNotes?.trim() || "No reason recorded",
        }]
      : []);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SKonnect";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet("Revoked Grantees");
    worksheet.columns = [...COLUMNS];
    worksheet.addRows(records);
    styleWorksheet(worksheet);

    logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "RECORDS_EXPORTED",
      resource: "grantees",
      metadata: {
        recordCount: records.length,
        filters: {
          status: GranteeStatus.REMOVED,
          reasonIncluded: true,
          reason: reasonFilter,
          startDate: dateRange.startDate?.toISOString() ?? null,
          endDate: dateRange.endDateExclusive?.toISOString() ?? null,
        },
      },
    });

    if (format === "csv") {
      return createCsvResponse(records, COLUMNS, `SKEAP-Revoked-Grantees-${new Date().getFullYear()}.xlsx`);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="SKEAP-Revoked-Grantees-${new Date().getFullYear()}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to export revoked grantees:", error);
    return NextResponse.json({ error: "Failed to generate revoked grantees report." }, { status: 500 });
  }
}
