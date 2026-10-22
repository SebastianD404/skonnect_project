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
      headerTitle="Manage account security"
      contentClassName="flex flex-1 flex-col p-0"
    >
      <PasswordSecurityForm />
    </SettingsShell>
  );
}
