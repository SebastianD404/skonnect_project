import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getSkeapWaitlistSnapshot } from "@/lib/skeap-waitlist";
import SkeapWaitlistClient from "./SkeapWaitlistClient";

export default async function SkeapWaitlistPage() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);
  const initialData = await getSkeapWaitlistSnapshot();

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8">
      <SkeapWaitlistClient initialData={initialData} />
    </div>
  );
}