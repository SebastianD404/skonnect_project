"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  emailConfirmation?: string;
  emailConfirmationReason?: string;
  pendingEmail?: string | null;
};

function looksLikeEmail(value: string) {
  return value.includes("@");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function dispatchProfileUpdate(fullName: string, email: string, phoneNumber = "") {
  window.dispatchEvent(new CustomEvent("skonnect-profile-updated", {
    detail: { fullName, email, phoneNumber },
  }));
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
  emailConfirmation,
  emailConfirmationReason,
  pendingEmail,
}: ProfileSettingsFormProps) {
  const router = useRouter();
  const [state, setState] = useState<{ error?: string; message?: string } | null>(
    emailConfirmation === "success"
      ? { message: "Your email was confirmed successfully." }
      : emailConfirmation === "error"
        ? { error: emailConfirmationReason === "otp_expired" ? "This confirmation link has expired or was already used. Submit the email change again to receive a new link." : "We could not confirm this email link. Submit the email change again to receive a new link." }
        : null
  );
  const [isPending, setIsPending] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState(() => ({
    fullName: toDisplayName(fullName, email),
    email,
    phoneNumber: phoneNumber ?? "",
    school: school === GRANTEE_PLACEHOLDER_SCHOOL ? "" : school,
    yearLevel: yearLevel === GRANTEE_PLACEHOLDER_YEAR_LEVEL ? "" : yearLevel,
  }));

  useEffect(() => {
    // Prefer server-stored avatar; fall back to local storage for older data
    (async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
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

    localStorage.setItem("skonnect-profile-name", toDisplayName(fullName, email));
    localStorage.setItem("skonnect-profile-email", email);

    if (phoneNumber) {
      localStorage.setItem("skonnect-profile-phone", phoneNumber);
    }

    window.dispatchEvent(new Event("skonnect-profile-updated"));
  }, [email, fullName, phoneNumber]);

  useEffect(() => {
    if (state?.message) {
      localStorage.setItem("skonnect-profile-name", toDisplayName(formData.fullName, formData.email));
      localStorage.setItem("skonnect-profile-email", formData.email);

      if (formData.phoneNumber.trim()) {
        localStorage.setItem("skonnect-profile-phone", formData.phoneNumber.trim());
      } else {
        localStorage.removeItem("skonnect-profile-phone");
      }

      dispatchProfileUpdate(formData.fullName, formData.email, formData.phoneNumber);
      router.refresh();
    }
  }, [state?.message, formData, router]);

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
          dispatchProfileUpdate(formData.fullName, formData.email, formData.phoneNumber);
        }
      })
      .catch(() => {});
  }

  function clearAvatar() {
    fetch("/api/avatar", { method: "DELETE" })
      .then(() => {
        localStorage.removeItem("skonnect-avatar");
        setAvatarPreview(null);
        dispatchProfileUpdate(formData.fullName, formData.email, formData.phoneNumber);
      })
      .catch(() => {
        localStorage.removeItem("skonnect-avatar");
        setAvatarPreview(null);
        dispatchProfileUpdate(formData.fullName, formData.email, formData.phoneNumber);
      });
  }

  function handleEmailChange(value: string) {
    setFormData((current) => ({ ...current, email: value }));
    dispatchProfileUpdate(formData.fullName, value, formData.phoneNumber);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState(null);

    const submittedForm = {
      ...formData,
      fullName: formData.fullName.trim(),
      email: formData.email.trim().toLowerCase(),
      phoneNumber: formData.phoneNumber.trim(),
      school: formData.school.trim(),
      yearLevel: formData.yearLevel.trim(),
    };

    if (!isValidEmail(submittedForm.email)) {
      setState({ error: "Please enter a valid email address." });
      return;
    }

    setIsPending(true);
    try {
      console.log("Submitting new email:", submittedForm.email);
      const response = await fetch("/api/grantee/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: submittedForm.fullName,
          email: submittedForm.email,
          phoneNumber: submittedForm.phoneNumber,
          school: submittedForm.school,
          yearLevel: submittedForm.yearLevel,
        }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      setState(response.ok ? result : { error: result.error || "We could not update your profile. Please try again." });
    } catch {
      setState({ error: "We could not reach the profile service. Please try again." });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
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
            <p className="text-xl font-bold text-[#0F3D5C]">{formData.fullName}</p>
            <p className="mt-1 text-sm text-slate-500">{formData.email}</p>
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

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {pendingEmail ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
              An email change to {pendingEmail} is currently pending. Please check your inbox.
            </div>
          ) : null}

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
              value={formData.fullName}
              onChange={(event) => setFormData((current) => ({ ...current, fullName: event.target.value }))}
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
                value={formData.email}
                onChange={(event) => handleEmailChange(event.target.value)}
                autoComplete="email"
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/10"
              />
              {formData.email.trim() && !isValidEmail(formData.email) ? (
                <p className="mt-2 text-xs text-red-600" role="alert">Enter a valid email address.</p>
              ) : null}
            </div>
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-slate-700 mb-2">Phone number</label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(event) => setFormData((current) => ({ ...current, phoneNumber: event.target.value }))}
                placeholder="Enter your phone number"
                required
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
                  value={formData.school}
                  onChange={(event) => setFormData((current) => ({ ...current, school: event.target.value }))}
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
                  value={formData.yearLevel}
                  onChange={(event) => setFormData((current) => ({ ...current, yearLevel: event.target.value }))}
                  placeholder="e.g. 1st Year"
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/10"
                />
              </div>
            </div>
          ) : null}

          {state?.error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {state.error}
            </div>
          )}

          {state?.message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
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