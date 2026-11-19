import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import ExcelJS from "exceljs";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import {
  getPlatformAccountUsersForExport,
  isPlatformAccountMetricKey,
  type PlatformAccountMetricKey,
} from "@/lib/platform-metrics";
import { getPlatformAccountExportCohort } from "@/lib/platform-account-export";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const ROLE_FILTERS: Record<string, Role | null> = {
  ALL: null,
  YOUTH: Role.YOUTH,
  GRANTEE: Role.GRANTEE,
  SK_ADMIN: Role.SK_OFFICIAL,
  SK_OFFICIAL: Role.SK_OFFICIAL,
  SYSTEM_ADMIN: Role.SUPER_ADMIN,
  SUPER_ADMIN: Role.SUPER_ADMIN,
};

const ROLE_LABELS: Record<string, string> = {
  YOUTH: "Youth",
  GRANTEE: "Grantee",
  SK_ADMIN: "SK Admin",
  SK_OFFICIAL: "SK Admin",
  SYSTEM_ADMIN: "System Admin",
  SUPER_ADMIN: "System Admin",
};

function getColumnWidth(values: string[], minimum: number) {
  const longestValue = values.reduce((longest, value) => Math.max(longest, value.length), 0);
  return Math.max(minimum, longestValue + 2);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();

    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await ensureProfile(sessionUser);
    if (!actor || actor.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rawRoleFilter = (searchParams.get("role") ?? "ALL").trim().toUpperCase();
    const role = ROLE_FILTERS[rawRoleFilter];
    if (role === undefined) {
      return NextResponse.json({ error: "Invalid role filter." }, { status: 400 });
    }

    const rawMetric = searchParams.get("metric");
    const metricValue = rawMetric ?? "all";
    if (!isPlatformAccountMetricKey(metricValue)) {
      return NextResponse.json({ error: "Invalid KPI filter." }, { status: 400 });
    }
    const metric: PlatformAccountMetricKey = metricValue;

    const query = (searchParams.get("q") ?? searchParams.get("query") ?? "").trim().slice(0, 100);
    const users = await getPlatformAccountUsersForExport({ metric, role, query });
    const headers = ["Full Name", "Email", "Current Role", "Account Status", "SKEAP Status", "Joined Date"];
    const rows = users.map((user) => [
      user.fullName || "Unnamed User",
      user.email,
      ROLE_LABELS[user.role] ?? user.role,
      user.isActive ? "Active" : "Inactive",
      user.skeapStatus,
      user.createdAt,
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SKonnect";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet("Users & Roles");
    worksheet.columns = headers.map((header, index) => ({
      width: getColumnWidth([header, ...rows.map((row) => String(row[index] ?? ""))], index === 0 ? 20 : 16),
    }));
    worksheet.addRow(headers);
    rows.forEach((row) => worksheet.addRow(row));

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2942" } };
    worksheet.getRow(1).alignment = { vertical: "middle" };
    worksheet.getColumn(6).numFmt = "mmm d, yyyy";
    worksheet.autoFilter = {
      from: "A1",
      to: `F${Math.max(1, rows.length + 1)}`,
    };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const filenameSegment = getPlatformAccountExportCohort(metric, role).slug;
    const filename = `skonnect-${filenameSegment}-${new Date().toISOString().slice(0, 10)}.xlsx`;

    await writeAuditLog(prisma, {
      action: "RECORDS_EXPORTED",
      actorId: actor.id,
      targetTable: "users",
      targetId: "bulk",
      metadata: {
        exportType: "system_admin_users",
        selectedRoleFilter: rawRoleFilter,
        metricFilter: metric,
        searchQuery: query || null,
        exportedRowCount: rows.length,
      },
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/system-admin/users/export]", error);
    return NextResponse.json({ error: "Failed to export users." }, { status: 500 });
  }
}
