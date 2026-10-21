"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, LockKeyhole, UserCircle } from "lucide-react";
import { useAuth } from "./AuthProvider";

const settingsNavItems = [
	{
		href: "/profile",
		label: "Personal Details",
		description: "Manage identity and academic details.",
		icon: UserCircle,
	},
	{
		href: "/settings/security",
		label: "Password & Security",
		description: "Update password and security options.",
		icon: LockKeyhole,
	},
	{
		href: "/settings/notifications",
		label: "Notifications",
		description: "Configure alerts and event updates.",
		icon: Bell,
	},
];

type SettingsShellProps = {
	title: string;
	description?: string;
	headerTitle?: string;
	children: React.ReactNode;
	profileName?: string;
	profileEmail?: string;
	profileAvatar?: string;
	contentClassName?: string;
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
	headerTitle,
	children,
	profileName: profileNameFromServer,
	profileEmail: profileEmailFromServer,
	profileAvatar: profileAvatarFromServer,
	contentClassName = "p-4 sm:p-6 lg:p-8",
}: SettingsShellProps) {
	const pathname = usePathname();
	const { user: authUser } = useAuth();
	const [profileName, setProfileName] = useState(profileNameFromServer ?? "Your account");
	const [profileEmail, setProfileEmail] = useState(profileEmailFromServer ?? "");
	const [profileAvatar, setProfileAvatar] = useState(profileAvatarFromServer ?? "");
	const sharedProfileName = authUser?.fullName ?? profileName;
	const sharedProfileEmail = authUser?.email ?? profileEmail;
	const sharedProfileAvatar = authUser?.avatarUrl ?? profileAvatar;

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
		return sharedProfileName
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase())
			.join("") || "?";
	}, [sharedProfileName]);

	return (
		<main className="min-h-screen bg-[#F0F2F5] text-slate-900">
			<div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 lg:px-6">
				<div className="mb-4 flex items-center justify-between rounded-[2rem] border border-slate-200 bg-white px-4 py-3 shadow-sm">
					<Link
						href="/grantee-dashboard"
						className="inline-flex h-9 items-center gap-2 rounded-full bg-[#0F3D5C] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
					>
						<span aria-hidden="true">←</span>
						Back to Home
					</Link>

					<div className="text-right">
						<p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#0F3D5C]">Settings</p>
						<p className="text-xs text-slate-500">Account controls</p>
					</div>
				</div>

				<div className="grid items-stretch gap-4 lg:grid-cols-[320px_1fr]">
					<aside className="flex h-full flex-col gap-3 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
						<div className="flex items-center gap-3 rounded-[1.5rem] bg-slate-50 px-4 py-4">
							<div className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#0F3D5C] text-base font-bold text-white shadow-sm">
								{sharedProfileAvatar ? <img src={sharedProfileAvatar} alt={sharedProfileName} className="h-full w-full object-cover" /> : initials}
							</div>
							<div className="min-w-0">
								<p className="truncate text-sm font-semibold uppercase tracking-[0.2em] text-[#0F3D5C]">Logged in as</p>
								<p className="truncate text-base font-bold text-slate-900">{sharedProfileName}</p>
								<p className="truncate text-sm text-slate-500">{sharedProfileEmail || "Profile ready"}</p>
							</div>
						</div>

						<div className="flex min-h-[104px] flex-col justify-center rounded-[1.5rem] bg-[#0F3D5C] p-4 text-white shadow-lg">
							<p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">Settings</p>
							<h1 className="mt-1 text-base font-bold leading-tight">{title}</h1>
							<p className="mt-1 line-clamp-1 text-[11px] leading-tight text-white/80">{description}</p>
						</div>

						<nav className="mt-0 flex flex-1 flex-col gap-1.5">
							{settingsNavItems.map(({ href, label, description: itemDescription, icon: Icon }) => {
								const isActive = pathname === href || pathname.startsWith(`${href}/`);
								return (
								<Link
									key={href}
									href={href}
									className={`flex w-full items-center gap-3 rounded-xl border-l-4 p-3.5 transition-all ${
										isActive
											? "border-slate-900 bg-slate-100 font-bold text-slate-900 shadow-2xs"
											: "border-transparent bg-transparent text-slate-600 hover:bg-slate-50"
									}`}
								>
									<Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-slate-900" : "text-slate-400"}`} aria-hidden="true" />
									<div className="min-w-0 flex-1">
										<p className={`text-xs ${isActive ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>{label}</p>
										<p className="mt-0.5 truncate whitespace-nowrap text-[10px] leading-none text-slate-500">{itemDescription}</p>
									</div>
								</Link>
								);
							})}
						</nav>
					</aside>

					<section className="flex h-full min-w-0 flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
						<div className="border-b border-slate-100 p-6">
							<p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
							{headerTitle ? <h2 className="text-xl font-bold text-slate-900">{headerTitle}</h2> : null}
							{description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
						</div>
						<div className={contentClassName}>{children}</div>
					</section>
				</div>
			</div>
		</main>
	);
}
