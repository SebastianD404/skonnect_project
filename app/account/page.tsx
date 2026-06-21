import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { SettingsShell } from "@/app/components/SettingsShell";
import { AccountPreferencesForm } from "./account-preferences-form";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await prisma.user.findUnique({
    where: { authId: user.id },
    select: {
      fullName: true,
      email: true,
      role: true,
      languagePref: true,
    },
  });

  if (!profile) {
    redirect("/login");
  }

  return (
    <SettingsShell title="Account preferences" description="Choose how SKonnect looks and feels.">
      <div className="space-y-3 border-b border-slate-200 pb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0F3D5C]">Account preferences</p>
        <h2 className="text-4xl font-black tracking-tight text-[#0F3D5C]">Choose how SKonnect looks and feels</h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Start with the basics: a light or dark appearance that follows your preference on this device.
        </p>
      </div>

      <AccountPreferencesForm
        fullName={profile.fullName}
        email={profile.email}
        role={profile.role}
        languagePref={profile.languagePref}
      />
    </SettingsShell>
  );
}