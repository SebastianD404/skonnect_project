import { GranteeStatus, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { ensureProfile } from "@/lib/auth";
import { formatDisplayName } from "@/lib/display-name";
import { hasGranteeColumn, prisma } from "@/lib/prisma";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { createClient } from "@/lib/supabase/server";
import ExitClearancesPageClient, { type ExitClearanceRow } from "./ExitClearancesPageClient";

export const dynamic = "force-dynamic";

export default async function ExitClearancesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    redirect("/admin");
  }

  const [hasFileNameColumn, hasSubmittedAtColumn] = await Promise.all([
    hasGranteeColumn("exitClearanceFileName"),
    hasGranteeColumn("exitClearanceSubmittedAt"),
  ]);
  const records = await prisma.grantee.findMany({
    where: {
      status: { in: [GranteeStatus.ACTIVE, GranteeStatus.PROBATIONARY] },
      OR: [
        { exitClearanceStatus: "SUBMITTED" },
        { exitClearanceUrl: { not: null } },
      ],
    },
    orderBy: [
      ...(hasSubmittedAtColumn ? [{ exitClearanceSubmittedAt: "desc" as const }] : []),
      { updatedAt: "desc" },
      { id: "asc" },
    ],
    select: {
      id: true,
      exitClearanceStatus: true,
      exitClearanceUrl: true,
      ...(hasFileNameColumn ? { exitClearanceFileName: true } : {}),
      ...(hasSubmittedAtColumn ? { exitClearanceSubmittedAt: true } : {}),
      school: true,
      yearLevel: true,
      user: {
        select: {
          fullName: true,
          email: true,
          kkProfile: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  const grantees: ExitClearanceRow[] = records.map((grantee) => {
    return {
      id: grantee.id,
      fullName: formatDisplayName(grantee.user.kkProfile, grantee.user.fullName),
      email: grantee.user.email,
      school: normalizeSkeapSchoolName(grantee.school),
      yearLevel: grantee.yearLevel,
      exitClearanceStatus: grantee.exitClearanceStatus ?? null,
      exitClearanceUrl: grantee.exitClearanceUrl,
      exitClearanceFileName:
        "exitClearanceFileName" in grantee ? grantee.exitClearanceFileName : null,
      exitClearanceSubmittedAt:
        "exitClearanceSubmittedAt" in grantee
          ? grantee.exitClearanceSubmittedAt?.toISOString() ?? null
          : null,
    };
  });

  return <ExitClearancesPageClient grantees={grantees} />;
}
