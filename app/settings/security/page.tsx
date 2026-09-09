import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { SettingsShell } from "@/app/components/SettingsShell";
import PasswordSecurityForm from "./PasswordSecurityForm";

export default async function SecuritySettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await ensureProfile(user);
  if (!profile) redirect("/login");

  return (
    <SettingsShell
      title="Password & Security"
      description="Manage your password and account security."
      profileName={profile.fullName}
      profileEmail={profile.email}
      profileAvatar={profile.avatarUrl ?? ""}
    >
      <PasswordSecurityForm />
    </SettingsShell>
  );
}
