import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import SupportInboxClient from "./SupportInboxClient";

type Props = {
  searchParams: Promise<{
    inquiry?: string;
    submitted?: string;
  }>;
};

export default async function GranteeInquiriesPage({ searchParams }: Props) {
  const [params, supabase] = await Promise.all([searchParams, createClient()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await prisma.user.findFirst({
    where: {
      OR: [{ authId: user.id }, { email: user.email ?? "" }],
    },
    select: { id: true, authId: true, role: true },
  });

  if (appUser && appUser.authId !== user.id) {
    try {
      await prisma.user.update({
        where: { id: appUser.id },
        data: { authId: user.id },
      });
    } catch {
      // Ignore relink failures and continue with fetched account data.
    }
  }

  if (!appUser || appUser.role !== "GRANTEE") {
    redirect("/login");
  }

  return (
    <SupportInboxClient
      basePath="/grantee-dashboard"
      initialInquiryId={params.inquiry ?? null}
      showSubmittedToast={params.submitted === "1"}
    />
  );
}
