import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import path from "node:path";
import { Role } from "@prisma/client";
import { ensureProfile } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit/logger";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function formatGranteeName(fullName: string, profile: { firstName: string; lastName: string } | null) {
  if (profile?.firstName && profile.lastName) {
    return `${profile.lastName}, ${profile.firstName}`;
  }

  const trimmedName = fullName.trim();
  if (trimmedName.includes(",")) {
    const [lastName, ...firstNameParts] = trimmedName.split(",");
    return `${lastName.trim()}, ${firstNameParts.join(",").trim()}`;
  }

  const nameParts = trimmedName.split(/\s+/).filter(Boolean);
  if (nameParts.length < 2) return trimmedName;

  return `${nameParts[nameParts.length - 1]}, ${nameParts[0]}`;
}

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
  if (!semesterId && !semesterName) {
    return NextResponse.json({ error: "A semester is required." }, { status: 400 });
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

    const submissions = await prisma.submission.findMany({
      where: {
        semester: { equals: selectedSemester, mode: "insensitive" },
        status: "APPROVED",
      },
      orderBy: [{ granteeId: "asc" }, { submittedAt: "desc" }],
      select: {
        granteeId: true,
        grantee: {
          select: {
            user: {
              select: {
                fullName: true,
                kkProfile: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    const uniqueGrantees = new Map(
      submissions.map((submission) => [
        submission.granteeId,
        formatGranteeName(submission.grantee.user.fullName, submission.grantee.user.kkProfile),
      ])
    );

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
    const grantees = Array.from(uniqueGrantees.values());
    const availableDataRows = totalRowIndexBeforeInsert - startRow;
    if (availableDataRows < 1) {
      return NextResponse.json({ error: "The payroll template is missing its scholar data rows." }, { status: 500 });
    }

    const additionalRows = Math.max(0, grantees.length - availableDataRows);
    if (additionalRows > 0) {
      worksheet.duplicateRow(totalRowIndexBeforeInsert - 1, additionalRows, true);
    }

    const grantAmount = 5000;

    grantees.forEach((applicantName, index) => {
      const rowIndex = startRow + index;
      worksheet.getCell(rowIndex, 1).value = index + 1;
      worksheet.getCell(rowIndex, 2).value = applicantName;
      worksheet.getCell(rowIndex, 3).value = "Scholar";
      worksheet.getCell(rowIndex, 4).value = grantAmount;
      worksheet.getCell(rowIndex, 7).value = grantAmount;
      worksheet.getCell(rowIndex, 8).value = grantAmount;
    });

    const totalRowIndex = totalRowIndexBeforeInsert + additionalRows;
    const totalAmount = grantees.length * grantAmount;
    for (const column of ["G", "H"]) {
      const totalCell = worksheet.getCell(`${column}${totalRowIndex}`);
      totalCell.value = totalAmount;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filenameSemester = selectedSemester.replace(/[^a-zA-Z0-9._ -]/g, "_").trim() || "semester";
    const filename = `SKEAP-PAYROLL-${filenameSemester}.xlsx`;

    logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "RECORDS_EXPORTED",
      resource: "accounting-payroll",
      metadata: { recordCount: uniqueGrantees.size, filters: { semester: selectedSemester } },
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
