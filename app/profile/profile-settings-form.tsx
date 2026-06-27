"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { updateProfileName } from "@/app/actions/profile";
import {
  GRANTEE_PLACEHOLDER_SCHOOL,
  GRANTEE_PLACEHOLDER_YEAR_LEVEL,
} from "@/lib/grantee-profile";

type ProfileSettingsFormProps = {
  fullName: string;
  email: string;
  role: string;
  phoneNumber: string | null;
  school: string;
  yearLevel: string;
  needsGranteeProfile: boolean;
};

function looksLikeEmail(value: string) {
  return value.includes("@");
}

function toDisplayName(name: string, email: string) {
  const cleanName = name.trim();
  if (cleanName && !looksLikeEmail(cleanName)) {
    return cleanName;
  }

  const localPart = email.split("@")[0]?.trim();
  if (!localPart) {
    return "Your account";
  }

  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function ProfileSettingsForm({
  fullName,
  email,
  role,
  phoneNumber,
  school,
  yearLevel,
  needsGranteeProfile,
}: ProfileSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(updateProfileName, null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [draftFullName, setDraftFullName] = useState(toDisplayName(fullName, email));
  const [draftEmail, setDraftEmail] = useState(email);
  const [draftPhoneNumber, setDraftPhoneNumber] = useState(phoneNumber ?? "");
  const [draftSchool, setDraftSchool] = useState(
    school === GRANTEE_PLACEHOLDER_SCHOOL ? "" : school
  );
  const [draftYearLevel, setDraftYearLevel] = useState(
    yearLevel === GRANTEE_PLACEHOLDER_YEAR_LEVEL ? "" : yearLevel
  );

  function broadcastProfileUpdate() {
    window.dispatchEvent(new Event("skonnect-profile-updated"));
  }

  useEffect(() => {
    // Prefer server-stored avatar; fall back to local storage for older data
    (async () => {
      try {
        const res = await fetch("/api/session");
        if (res.ok) {
          const body = await res.json();
          const serverUser = body.user;
          if (serverUser?.avatarUrl) {
            setAvatarPreview(serverUser.avatarUrl);
          } else {
            const storedAvatar = localStorage.getItem("skonnect-avatar");
            if (storedAvatar) setAvatarPreview(storedAvatar);
          }
        }
      } catch {}
    })();

    const storedName = localStorage.getItem("skonnect-profile-name");
    const storedEmail = localStorage.getItem("skonnect-profile-email");
    const storedPhoneNumber = localStorage.getItem("skonnect-profile-phone");

    if (storedName) {
      setDraftFullName(toDisplayName(storedName, storedEmail || email));
    }

    if (storedEmail) {
      setDraftEmail(storedEmail);
    }

    if (storedPhoneNumber) {
      setDraftPhoneNumber(storedPhoneNumber);
    }

    localStorage.setItem("skonnect-profile-name", toDisplayName(fullName, email));
    localStorage.setItem("skonnect-profile-email", email);

    if (phoneNumber) {
      localStorage.setItem("skonnect-profile-phone", phoneNumber);
    }

    broadcastProfileUpdate();
  }, []);

  useEffect(() => {
    if (state?.message) {
      localStorage.setItem("skonnect-profile-name", toDisplayName(draftFullName, draftEmail));
      localStorage.setItem("skonnect-profile-email", draftEmail);

      if (draftPhoneNumber.trim()) {
        localStorage.setItem("skonnect-profile-phone", draftPhoneNumber.trim());
      } else {
        localStorage.removeItem("skonnect-profile-phone");
      }

      broadcastProfileUpdate();
    }
  }, [state?.message, draftFullName, draftEmail, draftPhoneNumber]);

  function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const form = new FormData();
    form.append("avatar", file);

    fetch("/api/avatar", { method: "POST", body: form })
      .then((r) => r.json())
      .then((body) => {
        if (body.avatarUrl) {
          setAvatarPreview(body.avatarUrl);
          // Keep a local copy for backward compatibility
          try { localStorage.setItem("skonnect-avatar", body.avatarUrl); } catch {}
          broadcastProfileUpdate();
        }
      })
      .catch(() => {});
  }

  function clearAvatar() {
    fetch("/api/avatar", { method: "DELETE" })
      .then(() => {
        localStorage.removeItem("skonnect-avatar");
        setAvatarPreview(null);
        broadcastProfileUpdate();
      })
      .catch(() => {
        localStorage.removeItem("skonnect-avatar");
        setAvatarPreview(null);
        broadcastProfileUpdate();
      });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0F3D5C]">Preview</p>
        <div className="mt-6 flex flex-col items-center gap-4 text-center">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Profile preview" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-black text-[#0F3D5C]">{fullName.slice(0, 1).toUpperCase()}</span>
            )}
          </div>

          <div>
            <p className="text-xl font-bold text-[#0F3D5C]">{draftFullName}</p>
            <p className="mt-1 text-sm text-slate-500">{draftEmail}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{role}</p>
          </div>

          <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#0F3D5C] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
            Upload profile picture
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </label>

          <button
            type="button"
            onClick={clearAvatar}
            className="text-sm font-semibold text-slate-500 transition hover:text-[#0F3D5C]"
          >
            Remove local picture
          </button>
          <p className="max-w-sm text-xs leading-5 text-slate-500">
            The picture is saved in this browser for now. It is enough for a basic profile setup and can be upgraded to cloud storage later.
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0F3D5C]">Personal details</p>

        <form action={formAction} className="mt-6 space-y-5">
          {role === "GRANTEE" && needsGranteeProfile ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Complete your grantee profile to unlock document submissions.
            </div>
          ) : null}

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-2">
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              value={draftFullName}
              onChange={(event) => setDraftFullName(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/10"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={draftEmail}
                onChange={(event) => setDraftEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/10"
              />
            </div>
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-slate-700 mb-2">Phone number</label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={draftPhoneNumber}
                onChange={(event) => setDraftPhoneNumber(event.target.value)}
                placeholder="Optional"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/10"
              />
            </div>
          </div>

          {role === "GRANTEE" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="school" className="block text-sm font-medium text-slate-700 mb-2">School</label>
                <input
                  id="school"
                  name="school"
                  value={draftSchool}
                  onChange={(event) => setDraftSchool(event.target.value)}
                  placeholder="Enter your school"
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/10"
                />
              </div>
              <div>
                <label htmlFor="yearLevel" className="block text-sm font-medium text-slate-700 mb-2">Year level</label>
                <input
                  id="yearLevel"
                  name="yearLevel"
                  value={draftYearLevel}
                  onChange={(event) => setDraftYearLevel(event.target.value)}
                  placeholder="e.g. 1st Year"
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/10"
                />
              </div>
            </div>
          ) : null}

          {state?.error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          {state?.message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {state.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Saving..." : "Save changes"}
          </button>
        </form>
      </section>
    </div>
  );
}