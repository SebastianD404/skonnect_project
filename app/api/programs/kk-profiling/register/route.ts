import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Basic validation: consent required
    if (!body || !body.consent) {
      return NextResponse.json({ error: "Consent is required" }, { status: 400 });
    }

    // TODO: Persist profiling data in the database using Prisma or Supabase.
    console.log("KK profiling submission:", JSON.stringify(body));

    return NextResponse.json({ success: true, received: body });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
