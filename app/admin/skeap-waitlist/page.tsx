import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getSkeapWaitlistSnapshot } from "@/lib/skeap-waitlist";
import SkeapWaitlistClient from "./SkeapWaitlistClient";

export default async function SkeapWaitlistPage() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);
  const initialData = await getSkeapWaitlistSnapshot();

  return <SkeapWaitlistClient initialData={initialData} />;
}