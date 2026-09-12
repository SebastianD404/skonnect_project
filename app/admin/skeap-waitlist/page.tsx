import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import SkeapWaitlistClient from "./SkeapWaitlistClient";

export default async function SkeapWaitlistPage() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  return <SkeapWaitlistClient />;
}