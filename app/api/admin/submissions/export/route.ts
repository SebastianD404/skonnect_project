import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role, SubmissionStatus } from "@prisma/client";
import { ensureProfile } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit/logger";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAcademicTermScheduleState } from "@/lib/academic-term-schedule";

export const runtime = "nodejs";

const REPORT_TYPES = [
  "current",
  "missing_incomplete",
  "pending_review",
  "fully_cleared",
] as const;
type ReportType = (typeof REPORT_TYPES)[number];

const SUBMISSION_EXPORT_COLUMNS = [
  { header: "Name", key: "name", width: 35 },
  { header: "Email", key: "email", width: 35 },
  { header: "School", key: "school", width: 40 },
  { header: "Year Level", key: "yearLevel", width: 25 },
  { header: "Semester", key: "semester", width: 30 },
  { header: "Status", key: "status", width: 25 },
] as const;

function getSubmissionWhere(status: "pending" | "returned" | "cleared"): Prisma.SubmissionWhereInput {
  const withBothDocuments = {
    coeFileUrl: { not: "" },
    gradeFileUrl: { not: "" },
  };
  if (status === "pending") return { ...withBothDocuments, status: "PENDING" };
  if (status === "cleared") return { ...withBothDocuments, status: "APPROVED" };
  return {
    ...withBothDocuments,
    status: { in: ["RETURNED_FOR_EDIT", "REJECTED"] },
  };
}

function buildSearchWhere(search: string): Prisma.SubmissionWhereInput | null {
  if (!search) return null;
  const contains = { contains: search, mode: Prisma.QueryMode.insensitive };
  return {
    OR: [
      { semester: contains },
      { grantee: { is: { school: contains } } },
      { grantee: { is: { yearLevel: contains } } },
      { grantee: { is: { user: { is: { fullName: contains } } } } },
      { grantee: { is: { user: { is: { email: contains } } } } },
    ],
  };
}

function getStatusLabel(status: SubmissionStatus) {
  if (status === "APPROVED") return "Fully Cleared";
  if (status === "RETURNED_FOR_EDIT" || status === "REJECTED") return "Returned for Edits";
  return "Pending Review";
}

function styleWorksheet(worksheet: ExcelJS.Worksheet) {
  const header = worksheet.getRow(1);
  header.height = 25;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  header.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  worksheet.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      cell.alignment = row.number === 1
        ? { horizontal: "center", vertical: "middle", wrapText: true }
        : { horizontal: "left", vertical: "middle", wrapText: true };
    });
  });

  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount },
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

  const params = request.nextUrl.searchParams;
  const reportTypeValue = params.get("reportType") ?? "current";
  if (!REPORT_TYPES.includes(reportTypeValue as ReportType)) {
    return NextResponse.json({ error: "Invalid submissions report type." }, { status: 400 });
  }

  const reportType = reportTypeValue as ReportType;
  const search = params.get("search")?.trim() ?? "";
  const requestedSemester = params.get("semester")?.trim() ?? "";
  const requestedStatus = params.get("status");
  if (requestedStatus && !["pending", "returned", "cleared"].includes(requestedStatus)) {
    return NextResponse.json({ error: "Invalid submissions status filter." }, { status: 400 });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SKonnect";
    workbook.created = new Date();
    let reportRows: {
      name: string;
      email: string;
      school: string;
      yearLevel: string;
      semester: string;
      status: string;
    }[] = [];

    if (reportType === "missing_incomplete") {
      const schedule = await getAcademicTermScheduleState();
      const semester = requestedSemester && requestedSemester !== "all"
        ? requestedSemester
        : schedule.window.semester;
      const semesterFilter = semester
        ? { semester: { equals: semester, mode: "insensitive" as const } }
        : undefined;
      const missingDocumentFilter: Prisma.SubmissionWhereInput = {
        OR: [
          { coeFileUrl: "" },
          { gradeFileUrl: "" },
        ],
      };
      const missingSubmissionFilter: Prisma.GranteeWhereInput = semesterFilter
        ? {
            OR: [
              { submissions: { none: semesterFilter } },
              { submissions: { some: { ...semesterFilter, ...missingDocumentFilter } } },
            ],
          }
        : {
            OR: [
              { submissions: { none: {} } },
              { submissions: { some: missingDocumentFilter } },
            ],
          };
      const searchFilters: Prisma.GranteeWhereInput = {
        OR: [
          { user: { is: { fullName: { contains: search, mode: Prisma.QueryMode.insensitive } } } },
          { user: { is: { email: { contains: search, mode: Prisma.QueryMode.insensitive } } } },
          { school: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { yearLevel: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      };
      const granteeWhere: Prisma.GranteeWhereInput = {
        status: "ACTIVE",
        AND: [missingSubmissionFilter, ...(search ? [searchFilters] : [])],
      };

      const grantees = await prisma.grantee.findMany({
        where: granteeWhere,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: {
          school: true,
          yearLevel: true,
          user: { select: { fullName: true, email: true } },
          submissions: {
            where: { ...(semesterFilter ?? {}), ...missingDocumentFilter },
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: { semester: true, coeFileUrl: true, gradeFileUrl: true },
          },
        },
      });

      reportRows = grantees.map((grantee) => {
        const submission = grantee.submissions[0];
        const missingDocuments = [
          !submission?.coeFileUrl ? "Certificate of Enrollment" : null,
          !submission?.gradeFileUrl ? "Grade Report" : null,
        ].filter((document): document is string => document !== null);
        return {
          name: grantee.user.fullName,
          email: grantee.user.email || "N/A",
          school: grantee.school,
          yearLevel: grantee.yearLevel,
          semester: submission?.semester ?? semester ?? "All Semesters",
          status: submission ? `Incomplete: ${missingDocuments.join(", ")}` : "Missing Submission",
        };
      });

      if (reportRows.length === 0) {
        return NextResponse.json({ error: "No missing or incomplete submissions match this report." }, { status: 404 });
      }
    } else {
      const statusFilter = reportType === "pending_review"
        ? "pending"
        : reportType === "fully_cleared"
          ? "cleared"
          : params.get("status") === "returned"
            ? "returned"
            : params.get("status") === "cleared"
              ? "cleared"
              : "pending";
      const semester = requestedSemester && requestedSemester !== "all" ? requestedSemester : "";
      const searchWhere = buildSearchWhere(search);
      const where: Prisma.SubmissionWhereInput = {
        AND: [
          getSubmissionWhere(statusFilter),
          ...(semester ? [{ semester }] : []),
          ...(searchWhere ? [searchWhere] : []),
        ],
      };
      const submissions = await prisma.submission.findMany({
        where,
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        select: {
          semester: true,
          status: true,
          grantee: {
            select: {
              school: true,
              yearLevel: true,
              user: { select: { fullName: true, email: true } },
            },
          },
        },
      });

      if (submissions.length === 0) {
        return NextResponse.json({ error: "No submissions match the selected report filters." }, { status: 404 });
      }

      reportRows = submissions.map((submission) => ({
          name: submission.grantee.user.fullName,
          email: submission.grantee.user.email || "N/A",
          school: submission.grantee.school,
          yearLevel: submission.grantee.yearLevel,
          semester: submission.semester,
          status: getStatusLabel(submission.status),
        }));
    }

    const fileNames: Record<ReportType, string> = {
      current: "SKEAP-Submissions.xlsx",
      missing_incomplete: "SKEAP-Missing-Submissions.xlsx",
      pending_review: "SKEAP-Pending-Review.xlsx",
      fully_cleared: "SKEAP-Fully-Cleared.xlsx",
    };
    const filename = fileNames[reportType];

    logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "RECORDS_EXPORTED",
      resource: "submissions",
      metadata: { reportType, filters: { status: params.get("status"), search, semester: requestedSemester } },
    });

    const worksheet = workbook.addWorksheet(reportType === "missing_incomplete" ? "Missing Submissions" : "Submissions");
    worksheet.columns = [...SUBMISSION_EXPORT_COLUMNS];
    worksheet.addRows(reportRows);
    styleWorksheet(worksheet);
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("/api/admin/submissions/export error:", error);
    return NextResponse.json({ error: "Unable to export submissions." }, { status: 500 });
  }
}
