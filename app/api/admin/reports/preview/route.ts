import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import {
  buildReportDataset,
  isReportKey,
  ReportDatasetError,
} from "@/lib/report-dataset";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const reportKey = searchParams.get("type") ?? "";
  if (!isReportKey(reportKey)) {
    return NextResponse.json({ error: "Choose a valid report type." }, { status: 400 });
  }
  const filters: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key !== "type") filters[key] = value;
  });

  try {
    const dataset = await buildReportDataset(reportKey, filters);
    const isAggregate = reportKey === "demographic_distribution";
    return NextResponse.json({
      ...dataset,
      rows: isAggregate ? dataset.rows : dataset.rows.slice(0, 20),
      generatedAt: new Date().toISOString(),
      isAggregate,
      previewLimit: 20,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ReportDatasetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to build admin report preview:", error);
    return NextResponse.json({ error: "Unable to load report preview." }, { status: 500 });
  }
}
