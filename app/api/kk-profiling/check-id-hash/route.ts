import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const currentUser = await ensureProfile(user);
  if (!currentUser) {
    return NextResponse.json({ error: "Account profile not found." }, { status: 404 });
  }

  const body: unknown = await request.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("hash" in body) ||
    typeof body.hash !== "string" ||
    !/^[a-f\d]{64}$/i.test(body.hash)
  ) {
    return NextResponse.json({ error: "A valid SHA-256 hash is required." }, { status: 400 });
  }

  const duplicate = await prisma.kKProfile.findFirst({
    where: {
      idDocumentHash: body.hash.toLowerCase(),
      user: {
        is: {
          id: { not: currentUser.id },
          kkStatus: { in: ["PENDING", "APPROVED"] },
        },
      },
    },
    select: { id: true },
  });

  return NextResponse.json({
    isDuplicate: Boolean(duplicate),
    ...(duplicate
      ? {
          message:
            "This ID document has already been submitted under another SKonnect account. Please upload your own valid ID.",
        }
      : {}),
  });
}
