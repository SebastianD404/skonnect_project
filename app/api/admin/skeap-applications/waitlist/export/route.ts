import ExcelJS from "exceljs";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit/logger";
import { getSkeapWaitlistSnapshot } from "@/lib/skeap-waitlist";
import { createClient } from "@/lib/supabase/server";
import { createCsvResponse, parseReportDateRange, parseReportFormat } from "@/lib/report-export";
import { addReportHeading, styleReportTable } from "@/lib/excel-report-style";

export const runtime = "nodejs";

const COLUMNS = [
  { header: "Waitlist Position", key: "waitlistPosition", width: 18 },
  { header: "Applicant Name", key: "applicantName", width: 32 },
  { header: "Email", key: "emailAddress", width: 34 },
  { header: "Contact Number", key: "contactNumber", width: 20 },
  { header: "School", key: "school", width: 36 },
  { header: "Education Level", key: "educationLevel", width: 22 },
  { header: "Course", key: "currentCourse", width: 28 },
  { header: "Year Level", key: "yearLevel", width: 18 },
  { header: "Submitted Date", key: "submittedAt", width: 20 },
] as const;

function styleWorksheet(worksheet: ExcelJS.Worksheet) {
  addReportHeading(worksheet, worksheet.name);
  styleReportTable(worksheet, { headerRow: 5 });
  worksheet.getColumn("submittedAt").numFmt = "mmm d, yyyy";
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
  if (!format) return NextResponse.json({ error: "Format must be xlsx or csv." }, { status: 400 });
  if (dateRange.error) return NextResponse.json({ error: dateRange.error }, { status: 400 });

  try {
    const snapshot = await getSkeapWaitlistSnapshot();
    const applications = snapshot.applications.filter((application) => {
      const submittedAt = new Date(application.submittedAt);
      return (!dateRange.startDate || submittedAt >= dateRange.startDate)
        && (!dateRange.endDateExclusive || submittedAt < dateRange.endDateExclusive);
    });
    const rows = applications.map((application) => ({
      ...application,
      submittedAt: new Date(application.submittedAt),
    }));

    logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "RECORDS_EXPORTED",
      resource: "skeap_applications",
      metadata: {
        recordCount: rows.length,
        filters: {
          status: "WAITLISTED",
          startDate: dateRange.startDate?.toISOString() ?? null,
          endDate: dateRange.endDateExclusive?.toISOString() ?? null,
        },
      },
    });
    if (format === "csv") {
      return createCsvResponse(rows, COLUMNS, `SKEAP-Waitlisted-Applicants-${new Date().getFullYear()}.xlsx`);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SKonnect";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet("Waitlisted Applicants");
    worksheet.columns = [...COLUMNS];
    worksheet.addRows(rows);
    styleWorksheet(worksheet);

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="SKEAP-Waitlisted-Applicants-${new Date().getFullYear()}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to export SKEAP waitlist:", error);
    return NextResponse.json({ error: "Failed to generate SKEAP waitlist report." }, { status: 500 });
  }
}
