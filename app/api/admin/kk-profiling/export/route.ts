import { NextRequest, NextResponse } from "next/server";

// Export endpoint intentionally removed from UI. Keep a safe stub
// so tooling and type references don't break during development.
export async function GET(_req: NextRequest) {
  return NextResponse.json({ error: "Not available" }, { status: 404 });
}
