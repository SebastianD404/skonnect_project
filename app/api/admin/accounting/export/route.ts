import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import path from "node:path";
import { GranteeStatus, Prisma, Role, SubmissionStatus } from "@prisma/client";
import { ensureProfile } from "@/lib/auth";
import { formatPayrollGranteeName } from "@/lib/accounting-payroll";
import { logAuditEvent } from "@/lib/audit/logger";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const semesterId = searchParams.get("semesterId")?.trim();
  const semesterName = searchParams.get("semester")?.trim();
  const reportType = searchParams.get("reportType") ?? "master_payroll";
  const payoutStatus = searchParams.get("payoutStatus");
  const submissionStatus = searchParams.get("submissionStatus");
  const search = searchParams.get("search")?.trim() ?? "";
  if (!["current_view", "master_payroll", "pending_payouts", "received_payouts"].includes(reportType)) {
    return NextResponse.json({ error: "Invalid payroll report type." }, { status: 400 });
  }
  if (!semesterId && !semesterName) {
    return NextResponse.json({ error: "A semester is required." }, { status: 400 });
  }
  if (payoutStatus && !["pending", "received"].includes(payoutStatus)) {
    return NextResponse.json({ error: "Invalid payout status filter." }, { status: 400 });
  }
  if (
    submissionStatus &&
    (reportType !== "current_view" || !["submitted", "not_submitted"].includes(submissionStatus))
  ) {
    return NextResponse.json({ error: "Invalid submission status filter." }, { status: 400 });
  }

  try {
    const semesterRecord = semesterId
      ? await prisma.semester.findUnique({
          where: { id: semesterId },
          select: { name: true },
        })
      : null;
    const selectedSemester = (semesterRecord?.name ?? semesterName ?? semesterId ?? "")
      .replace(/\s*\(Current\)$/i, "")
      .trim();

    if (!selectedSemester) {
      return NextResponse.json({ error: "A valid semester is required." }, { status: 400 });
    }

    const semesterSubmissionFilter = {
      semester: { equals: selectedSemester, mode: "insensitive" as const },
    };
    const submittedSemesterFilter = {
      ...semesterSubmissionFilter,
      status: {
        notIn: [SubmissionStatus.REJECTED, SubmissionStatus.RETURNED_FOR_EDIT],
      },
    };
    const currentView = reportType === "current_view";
    const where: Prisma.GranteeWhereInput = {
      status: { in: [GranteeStatus.ACTIVE, GranteeStatus.PROBATIONARY] },
      user: {
        is: {
          isActive: true,
          role: Role.GRANTEE,
        },
      },
      ...(currentView
        ? submissionStatus === "submitted"
          ? { submissions: { some: submittedSemesterFilter } }
          : submissionStatus === "not_submitted"
            ? { NOT: { submissions: { some: submittedSemesterFilter } } }
            : {}
        : {}),
      ...(search
        ? {
            user: {
              is: {
                fullName: { contains: search, mode: Prisma.QueryMode.insensitive },
              },
            },
          }
        : {}),
    };

    const effectivePayoutStatus =
      currentView
        ? payoutStatus
        : reportType === "pending_payouts"
          ? "pending"
          : reportType === "received_payouts"
            ? "received"
            : undefined;
    if (effectivePayoutStatus === "received") {
      where.payout = { is: { disbursedAt: { not: null } } };
    } else if (effectivePayoutStatus === "pending") {
      where.OR = [
        { payout: { is: null } },
        { payout: { is: { disbursedAt: null } } },
      ];
    }

    const grantees = await prisma.grantee.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        user: {
          select: {
            fullName: true,
            kkProfile: {
              select: {
                lastName: true,
                firstName: true,
                middleName: true,
              },
            },
          },
        },
        submissions: {
          where: semesterSubmissionFilter,
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: { semester: true, status: true },
        },
        payout: { select: { status: true, disbursedAt: true, claimedAt: true } },
      },
    });

    if (grantees.length === 0) {
      return NextResponse.json(
        { error: "No grantee records match the selected report filters." },
        { status: 404 },
      );
    }

    const reportRows = grantees.map((grantee) => ({
      name: formatPayrollGranteeName(grantee.user.kkProfile, grantee.user.fullName),
      status: grantee.payout?.status === "CONFIRMED"
        ? "Confirmed"
        : grantee.payout?.status === "DISBURSED_UNCONFIRMED"
          ? "Awaiting Confirmation"
          : "Pending",
      semester: grantee.submissions[0]?.semester ?? selectedSemester,
    }));

    const semesterSlug =
      selectedSemester.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "semester";

    const workbook = new ExcelJS.Workbook();

    const templatePath = path.join(process.cwd(), "public", "SKEAP-PAYROLL-2026.xlsx");
    await workbook.xlsx.readFile(templatePath);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json({ error: "The payroll template has no worksheet." }, { status: 500 });
    }

    let totalRowIndexBeforeInsert = 0;
    worksheet.eachRow((row) => {
      const label = String(row.getCell(2).value ?? "").trim().toUpperCase();
      if (label === "TOTAL" && totalRowIndexBeforeInsert === 0) {
        totalRowIndexBeforeInsert = row.number;
      }
    });
    if (totalRowIndexBeforeInsert === 0) {
      return NextResponse.json({ error: "The payroll template is missing its TOTAL row." }, { status: 500 });
    }

    let headerRowIndex = 0;
    for (let rowIndex = 1; rowIndex < totalRowIndexBeforeInsert; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex);
      const hasNumberHeader = String(row.getCell(1).value ?? "").trim().toUpperCase() === "NO.";
      const hasNameHeader = String(row.getCell(2).value ?? "").trim().toUpperCase() === "NAME";
      if (hasNumberHeader && hasNameHeader) headerRowIndex = rowIndex;
    }

    if (headerRowIndex === 0) {
      return NextResponse.json({ error: "The payroll template is missing its scholar table header." }, { status: 500 });
    }

    const startRow = headerRowIndex + 1;
    const availableDataRows = totalRowIndexBeforeInsert - startRow;
    if (availableDataRows < 1) {
      return NextResponse.json({ error: "The payroll template is missing its scholar data rows." }, { status: 500 });
    }

    const additionalRows = Math.max(0, reportRows.length - availableDataRows);
    if (additionalRows > 0) {
      worksheet.duplicateRow(totalRowIndexBeforeInsert - 1, additionalRows, true);
    }

    const grantAmount = 5000;
    reportRows.forEach((applicant, index) => {
      const rowIndex = startRow + index;
      worksheet.getCell(rowIndex, 1).value = index + 1;
      worksheet.getCell(rowIndex, 2).value = applicant.name;
      worksheet.getCell(rowIndex, 3).value = "Scholar";
      worksheet.getCell(rowIndex, 4).value = grantAmount;
      worksheet.getCell(rowIndex, 7).value = grantAmount;
      worksheet.getCell(rowIndex, 8).value = grantAmount;
    });

    const totalRowIndex = totalRowIndexBeforeInsert + additionalRows;
    const totalAmount = reportRows.length * grantAmount;
    for (const column of ["G", "H"]) {
      worksheet.getCell(`${column}${totalRowIndex}`).value = totalAmount;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = currentView
      ? `SKEAP-PAYROLL-${semesterSlug}-Current-View.xlsx`
      : reportType === "pending_payouts"
        ? `SKEAP-Pending-Payouts-${semesterSlug}.xlsx`
        : reportType === "received_payouts"
          ? `SKEAP-Disbursed-Payouts-${semesterSlug}.xlsx`
        : `SKEAP-PAYROLL-${semesterSlug}.xlsx`;

    logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "RECORDS_EXPORTED",
      resource: "accounting-payroll",
      metadata: {
        recordCount: reportRows.length,
        filters: {
          semester: selectedSemester,
          reportType,
          payoutStatus: effectivePayoutStatus,
          submissionStatus: currentView ? submissionStatus ?? "all" : undefined,
          search: search || undefined,
        },
      },
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("/api/admin/accounting/export error:", error);
    return NextResponse.json({ error: "Unable to export the payroll workbook." }, { status: 500 });
  }
}
