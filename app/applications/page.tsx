import ApplicationsPageClient from "./ApplicationsPageClient";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getPastGranteeReapplicationState } from "@/lib/past-grantee-reapplication";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const appUser = user
    ? await prisma.user.findFirst({
        where: { authId: user.id, isActive: true },
        select: { id: true, role: true },
      })
    : null;
  const reapplicationState = await getPastGranteeReapplicationState(appUser?.id ?? null);

  return (
    <ApplicationsPageClient
      initialReapplicationState={
        appUser?.role === "YOUTH" ? reapplicationState : null
      }
    />
  );
}
