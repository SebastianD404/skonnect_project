import ExcelJS from "exceljs";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/logger";
import { getKKMemberArchiveReasonLabel } from "@/lib/kk-member-archive";

export const runtime = "nodejs";

const COLUMNS = [
  { header: "Registration ID", key: "id", width: 38 },
  { header: "Program", key: "program", width: 14 },
  { header: "Full Name", key: "fullName", width: 30 },
  { header: "Middle Name", key: "middleName", width: 20 },
  { header: "Address", key: "address", width: 36 },
  { header: "Sex", key: "sex", width: 12 },
  { header: "Age", key: "age", width: 10 },
  { header: "Birth Date", key: "birthDate", width: 18 },
  { header: "Email", key: "email", width: 32 },
  { header: "Facebook", key: "facebook", width: 30 },
  { header: "Contact Number", key: "contactNumber", width: 20 },
  { header: "Civil Status", key: "civilStatus", width: 16 },
  { header: "Youth Classification", key: "youthClassification", width: 24 },
  { header: "Youth Age Group", key: "youthAgeGroup", width: 20 },
  { header: "Work Status", key: "workStatus", width: 20 },
  { header: "Educational Background", key: "educationalBackground", width: 28 },
  { header: "Registered SK Voter", key: "registeredSKVoter", width: 20 },
  { header: "Voted Last SK Election", key: "votedLastSK", width: 22 },
  { header: "Registered National Voter", key: "registeredNationalVoter", width: 25 },
  { header: "Attended KK Assembly", key: "attendedKKAssembly", width: 22 },
  { header: "Assembly Times", key: "assemblyTimes", width: 18 },
  { header: "No Assembly Reason", key: "noAssemblyReason", width: 30 },
  { header: "Consent", key: "consent", width: 12 },
  { header: "Residency Acknowledged", key: "residencyStatementAcknowledgement", width: 24 },
  { header: "Manual Review Required", key: "requiresManualReview", width: 24 },
  { header: "ID Document Type", key: "idDocumentType", width: 20 },
  { header: "ID Front File URL", key: "idFrontFileUrl", width: 48 },
  { header: "ID Back File URL", key: "idBackFileUrl", width: 48 },
  { header: "Single ID File URL", key: "idSingleFileUrl", width: 48 },
  { header: "Submitted Date", key: "submittedAt", width: 20 },
  { header: "Review Status", key: "reviewStatus", width: 16 },
  { header: "Archive Reason", key: "archivedReason", width: 26 },
  { header: "Review Notes", key: "reviewNotes", width: 36 },
] as const;

function styleWorksheet(worksheet: ExcelJS.Worksheet) {
  const header = worksheet.getRow(1);
  header.height = 30;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  header.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
      if (rowNumber > 1) {
        cell.alignment = { vertical: "top", wrapText: true };
      }
    });
  });

  worksheet.getColumn("birthDate").numFmt = "mmm d, yyyy";
  worksheet.getColumn("submittedAt").numFmt = "mmm d, yyyy";
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNS.length },
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const records = await prisma.profilingRegistration.findMany({
      where: { reviewStatus: "Archived" },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        program: true,
        fullName: true,
        middleName: true,
        address: true,
        sex: true,
        age: true,
        birthDate: true,
        email: true,
        facebook: true,
        contactNumber: true,
        civilStatus: true,
        youthClassification: true,
        youthAgeGroup: true,
        workStatus: true,
        educationalBackground: true,
        registeredSKVoter: true,
        votedLastSK: true,
        registeredNationalVoter: true,
        attendedKKAssembly: true,
        assemblyTimes: true,
        noAssemblyReason: true,
        consent: true,
        residencyStatementAcknowledgement: true,
        requiresManualReview: true,
        idDocumentType: true,
        idFrontFileUrl: true,
        idBackFileUrl: true,
        idSingleFileUrl: true,
        submittedAt: true,
        reviewStatus: true,
        archivedReason: true,
        reviewNotes: true,
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SKonnect";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet("Archived KK Youth");
    worksheet.columns = [...COLUMNS];
    worksheet.addRows(records.map((record) => ({
      ...record,
      archivedReason: getKKMemberArchiveReasonLabel(record.archivedReason),
    })));
    styleWorksheet(worksheet);

    logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "RECORDS_EXPORTED",
      resource: "kk_profiling_registrations",
      metadata: {
        recordCount: records.length,
        filters: { reviewStatus: "Archived" },
      },
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Archived-KK-Youth.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to export archived member profiles:", error);
    return NextResponse.json(
      { error: "Failed to generate archived member report." },
      { status: 500 }
    );
  }
}
