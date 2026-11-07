import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAuditRoleChangeContext, getAuditTargetContext } from "@/lib/audit/metadata";
import { getAuditStartDate, isAuditTimeRange } from "@/lib/audit/time-range";
import { formatPhilippineTime } from "@/lib/audit/time";
import { ensureProfile } from "@/lib/auth";

function getColumnWidth(values: string[], minimum: number): number {
  const longestValue = values.reduce((longest, value) => Math.max(longest, value.length), 0);
  return Math.max(minimum, longestValue + 2);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await ensureProfile(user);

    if (!actor || actor.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("query") || "").trim();
    const requestedRange = searchParams.get("range") || "30d";
    if (!isAuditTimeRange(requestedRange)) {
      return NextResponse.json({ error: "Invalid audit time range." }, { status: 400 });
    }
    const startDate = getAuditStartDate(requestedRange);

    const audits = await prisma.auditLog.findMany({
      where: startDate ? { createdAt: { gte: startDate } } : undefined,
      take: 1000,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        targetTable: true,
        targetId: true,
        beforeData: true,
        afterData: true,
        metadata: true,
        meta: true,
        createdAt: true,
        actor: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    const queryValue = query.toLowerCase();
    const filteredAudits = queryValue
      ? audits.filter((audit) => {
          const roleContext = getAuditRoleChangeContext(audit);
          return [
            audit.action,
            audit.targetTable,
            audit.targetId,
            audit.actor.fullName,
            audit.actor.email,
            roleContext.targetUserName,
            roleContext.targetUserEmail,
            roleContext.oldRole,
            roleContext.newRole,
          ]
            .join(" ")
            .toLowerCase()
            .includes(queryValue);
        })
      : audits;

    const rows = filteredAudits.map((audit) => {
      const target = getAuditTargetContext(audit);

      return [
        audit.action,
        [audit.actor.fullName, audit.actor.email].filter(Boolean).join(" | ") || "System",
        [target.label, target.secondary].filter(Boolean).join(" | "),
        formatPhilippineTime(audit.createdAt),
      ];
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SKonnect";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet("Audit Logs");
    const headers = ["ACTION", "ACTOR", "TARGET", "RECORDED DATE & TIME"];
    worksheet.addRow(headers);
    rows.forEach((row) => worksheet.addRow(row));

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    worksheet.getRow(1).alignment = { vertical: "middle" };
    worksheet.autoFilter = {
      from: "A1",
      to: `D${Math.max(1, rows.length + 1)}`,
    };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.columns = [
      { key: "action", width: getColumnWidth([headers[0], ...rows.map((row) => row[0])], 18) },
      { key: "actor", width: getColumnWidth([headers[1], ...rows.map((row) => row[1])], 24) },
      { key: "target", width: getColumnWidth([headers[2], ...rows.map((row) => row[2])], 24) },
      { key: "recordedAt", width: getColumnWidth([headers[3], ...rows.map((row) => row[3])], 24) },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `SKonnect_Audit_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export audits";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
