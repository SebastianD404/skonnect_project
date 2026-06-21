"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SettingsShellProps = {
	title: string;
	description: string;
	children: React.ReactNode;
};

export function SettingsShell({ title, description, children }: SettingsShellProps) {
	const router = useRouter();
	const [profileName, setProfileName] = useState("Your account");
	const [profileEmail, setProfileEmail] = useState("");
	const [profileAvatar, setProfileAvatar] = useState("");

	useEffect(() => {
		function syncProfile() {
			try {
				setProfileName(localStorage.getItem("skonnect-profile-name") || "Your account");
				setProfileEmail(localStorage.getItem("skonnect-profile-email") || "");
				setProfileAvatar(localStorage.getItem("skonnect-avatar") || "");
			} catch (error) {}
		}

		syncProfile();
		window.addEventListener("storage", syncProfile);
		window.addEventListener("skonnect-profile-updated", syncProfile as EventListener);

		return () => {
			window.removeEventListener("storage", syncProfile);
			window.removeEventListener("skonnect-profile-updated", syncProfile as EventListener);
		};
	}, []);

	useEffect(() => {
		function syncTheme() {
			try {
				const savedTheme = localStorage.getItem("skonnect-theme");
				const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
				const shouldUseDark = savedTheme === "dark" || (!savedTheme && systemPrefersDark) || savedTheme === "system" && systemPrefersDark;
				document.documentElement.classList.toggle("dark", shouldUseDark);
				document.documentElement.dataset.theme = shouldUseDark ? "dark" : (savedTheme || "light");
				document.documentElement.style.colorScheme = shouldUseDark ? "dark" : "light";
			} catch (error) {}
		}

		syncTheme();
		window.addEventListener("storage", syncTheme);
		window.addEventListener("skonnect-theme-updated", syncTheme as EventListener);
		return () => {
			window.removeEventListener("storage", syncTheme);
			window.removeEventListener("skonnect-theme-updated", syncTheme as EventListener);
		};
	}, []);

	const initials = useMemo(() => {
		return profileName
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase())
			.join("") || "?";
	}, [profileName]);

	return (
		<main className="min-h-screen bg-[#F0F2F5] text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
			<div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 lg:px-6">
				<div className="mb-4 flex items-center justify-between rounded-[2rem] border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900">
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
					<aside className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900">
						<div className="flex items-center gap-3 rounded-[1.5rem] bg-slate-50 px-4 py-4 transition-colors dark:bg-slate-800/70">
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

						<div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 transition-colors dark:bg-slate-800 dark:text-slate-300">
							Use the back button above to return to the previous page.
						</div>

						<nav className="mt-4 space-y-2">
							<Link href="/profile" className="block rounded-2xl px-4 py-4 transition hover:bg-slate-50">
								<p className="text-sm font-bold text-[#0F3D5C]">Profile settings</p>
								<p className="mt-1 text-sm leading-6 text-slate-500">Edit your name and profile photo.</p>
							</Link>
							<Link href="/account" className="block rounded-2xl px-4 py-4 transition hover:bg-slate-50">
								<p className="text-sm font-bold text-[#0F3D5C]">Account preferences</p>
								<p className="mt-1 text-sm leading-6 text-slate-500">Choose appearance and other basics.</p>
							</Link>
						</nav>
					</aside>

					<section className="min-w-0 rounded-[2rem] border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900">
						<div className="border-b border-slate-200 px-4 py-4 sm:px-6 lg:px-8 dark:border-slate-700">
							<p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0F3D5C]">{title}</p>
							<p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
						</div>
						<div className="p-4 sm:p-6 lg:p-8">{children}</div>
					</section>
				</div>
			</div>
		</main>
	);
}
