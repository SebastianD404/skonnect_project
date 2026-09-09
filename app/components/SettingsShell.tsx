"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LockKeyhole, UserCircle } from "lucide-react";

type SettingsShellProps = {
	title: string;
	description: string;
	children: React.ReactNode;
	profileName?: string;
	profileEmail?: string;
	profileAvatar?: string;
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

export function SettingsShell({
	title,
	description,
	children,
	profileName: profileNameFromServer,
	profileEmail: profileEmailFromServer,
	profileAvatar: profileAvatarFromServer,
}: SettingsShellProps) {
	const router = useRouter();
	const pathname = usePathname();
	const [profileName, setProfileName] = useState(profileNameFromServer ?? "Your account");
	const [profileEmail, setProfileEmail] = useState(profileEmailFromServer ?? "");
	const [profileAvatar, setProfileAvatar] = useState(profileAvatarFromServer ?? "");

	useEffect(() => {
		const hasServerProfile = profileNameFromServer !== undefined || profileEmailFromServer !== undefined || profileAvatarFromServer !== undefined;

		if (hasServerProfile) {
			try {
				if (profileNameFromServer) {
					localStorage.setItem("skonnect-profile-name", profileNameFromServer);
				}
				if (profileEmailFromServer) {
					localStorage.setItem("skonnect-profile-email", profileEmailFromServer);
				}
				if (profileAvatarFromServer !== undefined) {
					if (profileAvatarFromServer) {
						localStorage.setItem("skonnect-avatar", profileAvatarFromServer);
					} else {
						localStorage.removeItem("skonnect-avatar");
					}
				}
			} catch (error) {}
		}
	}, [profileNameFromServer, profileEmailFromServer, profileAvatarFromServer]);

	useEffect(() => {
		function syncProfile(event?: Event) {
			try {
				const profileEvent = event as CustomEvent<{ fullName?: string; email?: string; avatarUrl?: string }> | undefined;
				if (profileEvent?.detail) {
					if (profileEvent.detail.fullName !== undefined) {
						setProfileName(toDisplayName(profileEvent.detail.fullName, profileEvent.detail.email || profileEmailFromServer || ""));
					}
					if (profileEvent.detail.email !== undefined) {
						setProfileEmail(profileEvent.detail.email);
					}
					if (profileEvent.detail.avatarUrl !== undefined) {
						setProfileAvatar(profileEvent.detail.avatarUrl);
					}
					return;
				}

				const storedName = localStorage.getItem("skonnect-profile-name") || "";
				const storedEmail = localStorage.getItem("skonnect-profile-email") || "";
				const storedAvatar = localStorage.getItem("skonnect-avatar") || "";
				const hasServerProfile = profileNameFromServer !== undefined || profileEmailFromServer !== undefined || profileAvatarFromServer !== undefined;

				if (hasServerProfile) {
					setProfileName(profileNameFromServer ?? "Your account");
					setProfileEmail(profileEmailFromServer ?? "");
					setProfileAvatar(profileAvatarFromServer ?? "");
					return;
				}

				if (storedName || storedEmail || storedAvatar) {
					setProfileName(toDisplayName(storedName, storedEmail || ""));
					setProfileEmail(storedEmail);
					setProfileAvatar(storedAvatar);
					return;
				}

				setProfileName("Your account");
				setProfileEmail("");
				setProfileAvatar("");
			} catch (error) {}
		}

		syncProfile();
		window.addEventListener("storage", syncProfile);
		window.addEventListener("skonnect-profile-updated", syncProfile as EventListener);

		return () => {
			window.removeEventListener("storage", syncProfile);
			window.removeEventListener("skonnect-profile-updated", syncProfile as EventListener);
		};
	}, [profileNameFromServer, profileEmailFromServer, profileAvatarFromServer]);

	const initials = useMemo(() => {
		return profileName
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase())
			.join("") || "?";
	}, [profileName]);

	return (
		<main className="min-h-screen bg-[#F0F2F5] text-slate-900">
			<div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 lg:px-6">
				<div className="mb-4 flex items-center justify-between rounded-[2rem] border border-slate-200 bg-white px-4 py-3 shadow-sm">
					<button
						type="button"
						onClick={() => router.back()}
						className="inline-flex items-center gap-2 rounded-full bg-[#0F3D5C] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
					>
						<span aria-hidden="true">←</span>
						Back
					</button>

					<div className="text-right">
						<p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#0F3D5C]">Settings</p>
						<p className="text-xs text-slate-500">Account controls</p>
					</div>
				</div>

				<div className="grid gap-4 lg:grid-cols-[320px_1fr]">
					<aside className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
						<div className="flex items-center gap-3 rounded-[1.5rem] bg-slate-50 px-4 py-4">
							<div className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#0F3D5C] text-base font-bold text-white shadow-sm">
								{profileAvatar ? <img src={profileAvatar} alt={profileName} className="h-full w-full object-cover" /> : initials}
							</div>
							<div className="min-w-0">
								<p className="truncate text-sm font-semibold uppercase tracking-[0.2em] text-[#0F3D5C]">Logged in as</p>
								<p className="truncate text-base font-bold text-slate-900">{profileName}</p>
								<p className="truncate text-sm text-slate-500">{profileEmail || "Profile ready"}</p>
							</div>
						</div>

						<div className="rounded-[1.5rem] bg-[#0F3D5C] px-5 py-5 text-white shadow-lg">
							<p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">Settings</p>
							<h1 className="mt-3 text-2xl font-black leading-tight">{title}</h1>
							<p className="mt-2 text-sm leading-6 text-white/80">{description}</p>
						</div>

						<nav className="mt-4 space-y-2">
							<Link
								href="/profile"
								className={pathname === "/profile"
									? "block rounded-r-lg border-l-4 border-blue-600 bg-blue-50 px-4 py-4 text-blue-700 transition-colors"
									: "block rounded-lg px-4 py-4 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"}
							>
								<UserCircle className="mr-3 inline-block h-5 w-5 align-middle" aria-hidden="true" />
								<p className="text-sm font-semibold">Personal Details</p>
								<p className="mt-1 text-sm leading-6 opacity-75">Edit your identity and academic details.</p>
							</Link>
							{[
								{ href: "/settings/security", label: "Password & Security", description: "Change your password securely.", icon: LockKeyhole },
								{ href: "/settings/notifications", label: "Notifications", description: "Manage alerts and assembly schedules.", icon: Bell },
							].map(({ href, label, description: itemDescription, icon: Icon }) => (
								<Link
									key={href}
									href={href}
									className={pathname === href
										? "block rounded-r-lg border-l-4 border-blue-600 bg-blue-50 px-4 py-4 text-blue-700 transition-colors"
										: "block rounded-lg px-4 py-4 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"}
								>
									<Icon className="mr-3 inline-block h-5 w-5 align-middle" aria-hidden="true" />
									<p className="inline align-middle text-sm font-semibold">{label}</p>
									<p className="mt-1 text-sm leading-6 opacity-75">{itemDescription}</p>
								</Link>
								))}
						</nav>
					</aside>

					<section className="min-w-0 rounded-[2rem] border border-slate-200 bg-white shadow-sm">
						<div className="border-b border-slate-200 px-4 py-4 sm:px-6 lg:px-8">
							<p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0F3D5C]">{title}</p>
							<p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
						</div>
						<div className="p-4 sm:p-6 lg:p-8">{children}</div>
					</section>
				</div>
			</div>
		</main>
	);
}
