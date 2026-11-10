import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getRoleHomePath } from "@/lib/auth";

export const dynamic = "force-dynamic";

const REVOKED_GRANTEE_STATUSES = new Set(["REMOVED", "REVOKED"]);

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
      grantee: { select: { status: true, remarks: true } },
    },
  });

  if (!appUser || !appUser.isActive) {
    redirect("/login");
  }

  if (REVOKED_GRANTEE_STATUSES.has(appUser.grantee?.status ?? "")) {
    return <AccessDeniedState reason={appUser.grantee?.remarks ?? null} title="Access Revoked" />;
  }

  if (appUser.grantee?.status === "GRADUATED") {
    return (
      <AccessDeniedState
        reason={appUser.grantee.remarks ?? null}
        title="Scholarship Completed"
      />
    );
  }

  if (appUser.role !== "GRANTEE") {
    redirect(getRoleHomePath(appUser.role) ?? "/applications");
  }

  if (!appUser.grantee) {
    redirect("/applications");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] text-[#1A1A1A]">
      {children}
    </div>
  );
}

function AccessDeniedState({
  reason,
  title,
}: {
  reason: string | null;
  title: "Access Revoked" | "Scholarship Completed";
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 mb-6 text-sm text-slate-500">
          {title === "Access Revoked"
            ? "Your SKEAP scholarship status has been updated by the administration. You have been transitioned to a standard youth member."
            : "Your SKEAP scholarship has been marked as completed. You can still access your account and application history."}
        </p>
        {reason?.trim() ? (
          <div className="mb-6 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Reason for Revocation / Admin Notes
            </span>
            <p className="text-sm italic text-slate-700">&ldquo;{reason.trim()}&rdquo;</p>
          </div>
        ) : null}
        <p className="mb-6 text-sm leading-6 text-slate-600">
          Please contact the SKEAP administration if you have questions about this decision.
        </p>
        <a
          href={title === "Access Revoked" ? "/youth-dashboard" : "/applications"}
          className="w-full rounded-xl bg-[#0F3D5C] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0B3049] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D5C]/40 focus-visible:ring-offset-2"
        >
          Okay, I Understand
        </a>
      </div>
    </div>
  );
}
