import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SKEAP_MAX_SLOTS,
  SKEAP_MAX_SLOTS_KEY,
  getSkeapCapacitySnapshot,
  lockSkeapCapacity,
  setSkeapMaxSlots,
} from "@/lib/skeap-capacity";
import { dispatchWaitlistSlotOffers } from "@/lib/skeap-waitlist-offers";

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

  const capacity = await getSkeapCapacitySnapshot();
  return NextResponse.json({ key: SKEAP_MAX_SLOTS_KEY, value: capacity.maxSlots, defaultValue: DEFAULT_SKEAP_MAX_SLOTS });
}

export async function PATCH(request: Request) {
  const auth = await authorizeAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const value = typeof body?.value === "number" ? body.value : Number(body?.value);
  if (!Number.isInteger(value) || value < 1 || value > DEFAULT_SKEAP_MAX_SLOTS) {
    return NextResponse.json({ error: `Slot limit must be a whole number between 1 and ${DEFAULT_SKEAP_MAX_SLOTS}.` }, { status: 400 });
  }

  let saved: {
    setting: { key: string; value: number; updatedAt: Date };
    previousValue: number;
  };
  try {
    saved = await prisma.$transaction(async (tx) => {
      await lockSkeapCapacity(tx);
      const capacity = await getSkeapCapacitySnapshot(tx);
      if (value < capacity.activeCount) {
        throw new Error("SLOT_LIMIT_BELOW_ACTIVE_COUNT");
      }
      const previousValue = capacity.maxSlots;
      const setting = await setSkeapMaxSlots(value, tx);
      return { setting, previousValue };
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

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/grantees");
  revalidatePath("/admin/skeap-waitlist");
  revalidatePath("/programs/skeap");

  let waitlistOffers: Awaited<ReturnType<typeof dispatchWaitlistSlotOffers>> | null = null;
  if (saved.setting.value > saved.previousValue) {
    try {
      waitlistOffers = await dispatchWaitlistSlotOffers();
    } catch (error) {
      console.error("SKEAP capacity was increased, but waitlist offers could not be dispatched:", error);
      return NextResponse.json(
        {
          code: "CAPACITY_UPDATED_OFFERS_NOT_DISPATCHED",
          error: "The slot limit was updated, but waitlist offers could not be sent. Retry Notify Next Eligible on the waitlist page.",
          key: saved.setting.key,
          value: saved.setting.value,
        },
        { status: 503 },
      );
    }
  }

  return NextResponse.json({
    key: saved.setting.key,
    value: saved.setting.value,
    updatedAt: saved.setting.updatedAt.toISOString(),
    waitlistOffers,
  });
}