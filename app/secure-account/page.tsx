import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile, getRoleHomePath } from "@/lib/auth";
import SecureAccountForm from "./SecureAccountForm";

function fallbackUsername(email: string) {
  const local = email.split("@")[0] || "pico.user";
  return local.toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

function sanitizeSuggestedUsername(username: string | null | undefined, email: string) {
  return username && /^[a-zA-Z0-9._-]+$/.test(username)
    ? username
    : fallbackUsername(email);
}

function getRedirectLabel(redirect?: string) {
  if (!redirect) return undefined;
  if (redirect.startsWith("/applications/")) return "your application status";
  if (redirect.startsWith("/grantee-dashboard")) return "your grantee dashboard";
  if (redirect.startsWith("/profile")) return "your profile";
  if (redirect.startsWith("/admin")) return "the admin area";
  return "your requested page";
}

export default async function SecureAccountPage({ searchParams }: { searchParams?: { [key: string]: string | undefined } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectParam = searchParams?.redirect ?? undefined;
  const redirectQuery = redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : "";
  const redirectLabel = getRedirectLabel(redirectParam);

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/secure-account${redirectQuery}`)}`);
  }

  const appUser = await ensureProfile(user);
  if (!appUser) {
    redirect(`/login?next=${encodeURIComponent(`/secure-account${redirectQuery}`)}`);
  }

  if (!appUser.mustSecureAccount) {
    redirect(getRoleHomePath(appUser.role) || "/");
  }

  const suggestedUsername = sanitizeSuggestedUsername(appUser.username, appUser.email);

  return (
    <SecureAccountForm
      suggestedUsername={suggestedUsername}
      redirect={redirectParam}
      redirectLabel={redirectLabel}
    />
  );
}
