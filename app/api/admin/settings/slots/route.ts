import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SKEAP_MAX_SLOTS,
  SKEAP_MAX_SLOTS_KEY,
  getSkeapCapacityCount,
  getSkeapMaxSlots,
  lockSkeapCapacity,
  setSkeapMaxSlots,
} from "@/lib/skeap-capacity";

async function authorizeAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const appUser = await ensureProfile(user);
  if (!appUser || (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user: appUser };
}

export async function GET() {
  const auth = await authorizeAdmin();
  if ("error" in auth) return auth.error;

  const maxSlots = await getSkeapMaxSlots();
  return NextResponse.json({ key: SKEAP_MAX_SLOTS_KEY, value: maxSlots, defaultValue: DEFAULT_SKEAP_MAX_SLOTS });
}

export async function PATCH(request: Request) {
  const auth = await authorizeAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const value = typeof body?.value === "number" ? body.value : Number(body?.value);
  if (!Number.isInteger(value) || value < 1 || value > DEFAULT_SKEAP_MAX_SLOTS) {
    return NextResponse.json({ error: `Slot limit must be a whole number between 1 and ${DEFAULT_SKEAP_MAX_SLOTS}.` }, { status: 400 });
  }

  let setting: { key: string; value: number; updatedAt: Date };
  try {
    setting = await prisma.$transaction(async (tx) => {
      await lockSkeapCapacity(tx);
      const activeCount = await getSkeapCapacityCount(tx);
      if (value < activeCount) {
        throw new Error("SLOT_LIMIT_BELOW_ACTIVE_COUNT");
      }
      return setSkeapMaxSlots(value, tx);
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SLOT_LIMIT_BELOW_ACTIVE_COUNT") {
      return NextResponse.json(
        {
          error: `The slot limit cannot be lowered below the current active SKEAP count. Reconcile active records first. The hard maximum remains ${DEFAULT_SKEAP_MAX_SLOTS}.`,
        },
        { status: 409 }
      );
    }
    throw error;
  }

  return NextResponse.json({ key: setting.key, value: setting.value, updatedAt: setting.updatedAt.toISOString() });
}