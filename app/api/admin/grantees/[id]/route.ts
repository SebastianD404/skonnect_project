import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";

async function authorizeUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const appUser = await ensureProfile(user);
  if (!appUser) {
    return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) };
  }

  if (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Only SK officials can delete grantees" },
        { status: 403 }
      ),
    };
  }

  return { user: appUser };
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing grantee id" }, { status: 400 });
    }

    const auth = await authorizeUser();
    if (auth.error) {
      return auth.error;
    }

    const grantee = await prisma.grantee.findUnique({ where: { id } });
    if (!grantee) {
      return NextResponse.json({ error: "Grantee not found" }, { status: 404 });
    }

    await prisma.grantee.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to delete grantee:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to delete grantee", details: errorMessage },
      { status: 500 }
    );
  }
}
