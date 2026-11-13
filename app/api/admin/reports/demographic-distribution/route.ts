import ExcelJS from "exceljs";
import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { buildDemographicDistributionRows } from "@/lib/demographic-distribution";
import { styleReportTable } from "@/lib/excel-report-style";
import { PICO_SITIOS } from "@/lib/barangay-sitios";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  try {
    const groups = await prisma.$queryRaw<Array<{ purok: string; sex: string; count: number }>>`
      SELECT
        profile."purok" AS "purok",
        profile."sex"::text AS "sex",
        COUNT(*)::int AS "count"
      FROM public."kk_profiles" AS profile
      WHERE profile."isVerified" = TRUE
      GROUP BY profile."purok", profile."sex"
    `;
    const rows = buildDemographicDistributionRows(groups, PICO_SITIOS);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SKonnect";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet("Gender by Sitio");
    const tableHeaderRow = 5;

    worksheet.mergeCells("A1:D1");
    worksheet.getCell("A1").value = "DEMOGRAPHIC DISTRIBUTION (GENDER & SITIO)";
    worksheet.getCell("A1").font = { bold: true, size: 15, color: { argb: "FF0F3D5C" } };
    worksheet.getCell("A1").alignment = { vertical: "middle" };
    worksheet.getRow(1).height = 28;

    worksheet.mergeCells("A2:D2");
    worksheet.getCell("A2").value = `Generated ${new Date().toLocaleDateString("en-PH")}`;
    worksheet.getCell("A2").font = { size: 10, color: { argb: "FF64748B" } };

    worksheet.mergeCells("A3:D3");
    worksheet.getCell("A3").value =
      "Total Youth includes verified profiles with unspecified sex; male and female columns show recorded categories only.";
    worksheet.getCell("A3").font = { italic: true, size: 9, color: { argb: "FF64748B" } };
    worksheet.getCell("A3").alignment = { wrapText: true, vertical: "middle" };
    worksheet.getRow(3).height = 30;

    worksheet.addTable({
      name: "GenderDistributionBySitio",
      ref: `A${tableHeaderRow}`,
      headerRow: true,
      totalsRow: false,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: [
        { name: "Sitio Name", filterButton: true },
        { name: "Total Male Youth", filterButton: true },
        { name: "Total Female Youth", filterButton: true },
        { name: "Total Youth", filterButton: true },
      ],
      rows: rows.map((row) => [row.sitio, row.male, row.female, row.total]),
    });

    worksheet.columns = [
      { key: "sitio", width: 30 },
      { key: "male", width: 20 },
      { key: "female", width: 22 },
      { key: "total", width: 17 },
    ];
    const lastDataRow = tableHeaderRow + rows.length;
    const totalsRow = worksheet.getRow(lastDataRow + 1);
    totalsRow.getCell(1).value = "Grand Total";
    totalsRow.getCell(2).value = rows.reduce((sum, row) => sum + row.male, 0);
    totalsRow.getCell(3).value = rows.reduce((sum, row) => sum + row.female, 0);
    totalsRow.getCell(4).value = rows.reduce((sum, row) => sum + row.total, 0);
    styleReportTable(worksheet, {
      headerRow: tableHeaderRow,
      lastDataRow: totalsRow.number,
      filterLastRow: lastDataRow,
    });

    const notSpecifiedCount = groups
      .filter((group) => group.sex === "NOT_SPECIFIED")
      .reduce((sum, group) => sum + group.count, 0);
    worksheet.mergeCells("A4:D4");
    worksheet.getCell("A4").value = `Verified profiles with unspecified sex: ${notSpecifiedCount.toLocaleString("en-PH")}`;
    worksheet.getCell("A4").font = { size: 9, color: { argb: "FF64748B" } };

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="demographic-distribution-gender-sitio.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to generate demographic distribution report:", error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      return NextResponse.json(
        { error: "The demographic report database migration is pending. Apply the latest Prisma migrations, then retry." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Unable to generate the demographic distribution report." }, { status: 500 });
  }
}
