import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { SettingsShell } from "@/app/components/SettingsShell";
import { ProfileSettingsForm } from "./profile-settings-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await prisma.user.findUnique({
    where: { authId: user.id },
    select: {
      fullName: true,
      email: true,
      phoneNumber: true,
      role: true,
    },
  });

  if (!profile) {
    redirect("/login");
  }

  return (
    <SettingsShell title="Profile settings" description="Edit your personal details and profile photo.">
      <div className="space-y-3 border-b border-slate-200 pb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0F3D5C]">Profile settings</p>
        <h2 className="text-4xl font-black tracking-tight text-[#0F3D5C]">Edit your personal details</h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Update the name shown across the portal and choose a profile picture for this browser.
        </p>
      </div>

      <ProfileSettingsForm
        fullName={profile.fullName}
        email={profile.email}
        phoneNumber={profile.phoneNumber}
        role={profile.role}
      />
    </SettingsShell>
  );
}