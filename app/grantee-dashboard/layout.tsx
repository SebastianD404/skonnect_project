import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getRoleHomePath } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function GranteeDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await prisma.user.findUnique({
    where: { authId: user.id },
    select: {
      isActive: true,
      role: true,
      id: true,
    },
  });

  if (!appUser || !appUser.isActive) {
    redirect("/login");
  }

  if (appUser.role !== "GRANTEE") {
    redirect(getRoleHomePath(appUser.role) ?? "/");
  }

  const activeGrantee = await prisma.grantee.findFirst({
    where: {
      userId: appUser.id,
      status: { notIn: ["GRADUATED", "REVOKED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });

  if (!activeGrantee || !["ACTIVE", "PROBATIONARY"].includes(activeGrantee.status)) {
    redirect("/youth/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] text-[#1A1A1A]">
      {children}
    </div>
  );
}
