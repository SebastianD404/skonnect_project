import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "This guest-registration endpoint has been retired. Sign in and submit KK Profiling from your account.",
    },
    { status: 410 },
  );
}
