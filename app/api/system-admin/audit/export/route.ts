import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAuditRoleChangeContext } from "@/lib/audit/metadata";
import { ensureProfile } from "@/lib/auth";

function csvEscape(value: unknown): string {
  const raw = String(value ?? "");
  if (!/[",\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
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

    const audits = await prisma.auditLog.findMany({
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

    const header = [
      "recorded_at_utc",
      "action",
      "actor_name",
      "actor_email",
      "target_label",
      "target_id",
      "old_role",
      "new_role",
      "ip_address",
      "target_table",
      "metadata_json",
      "meta_json",
    ];

    const rows = filteredAudits.map((audit) => {
      const roleContext = getAuditRoleChangeContext(audit);
      const targetLabel =
        audit.action === "UPDATE_USER_ROLE"
          ? roleContext.targetUserName || roleContext.targetUserEmail || "Unknown user"
          : audit.targetTable;

      return [
        new Date(audit.createdAt).toISOString(),
        audit.action,
        audit.actor.fullName,
        audit.actor.email,
        targetLabel,
        audit.targetId,
        roleContext.oldRole,
        roleContext.newRole,
        roleContext.ipAddress,
        audit.targetTable,
        JSON.stringify(audit.metadata ?? {}),
        JSON.stringify(audit.meta ?? {}),
      ].map(csvEscape);
    });

    const csv = [header.map(csvEscape).join(","), ...rows.map((row) => row.join(","))].join("\n");
    const filename = `audit-export-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export audits";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
