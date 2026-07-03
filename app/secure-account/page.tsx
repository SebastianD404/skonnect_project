import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile, getRoleHomePath } from "@/lib/auth";
import SecureAccountForm from "./SecureAccountForm";

function fallbackUsername(email: string) {
  const local = email.split("@")[0] || "pico.user";
  return local.toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export default async function SecureAccountPage({ searchParams }: { searchParams?: { [key: string]: string | undefined } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await ensureProfile(user);
  if (!appUser) {
    redirect("/login");
  }

  if (!appUser.mustSecureAccount) {
    redirect(getRoleHomePath(appUser.role) || "/");
  }

  const redirectParam = searchParams?.redirect ?? undefined;

  return (
    <SecureAccountForm
      suggestedUsername={appUser.username || fallbackUsername(appUser.email)}
      redirect={redirectParam}
    />
  );
}
