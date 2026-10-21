import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { SettingsShell } from "@/app/components/SettingsShell";
import NotificationsSettingsForm from "./NotificationsSettingsForm";

export default async function NotificationsSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await ensureProfile(user);
  if (!profile) redirect("/login");

  return (
    <SettingsShell
      title="Notifications"
      headerTitle="Notification preferences"
      description="Choose how SKonnect keeps you informed about important grant updates."
      profileName={profile.fullName}
      profileEmail={profile.email}
      profileAvatar={profile.avatarUrl ?? ""}
      contentClassName="flex flex-1 flex-col p-0"
    >
      <NotificationsSettingsForm />
    </SettingsShell>
  );
}
