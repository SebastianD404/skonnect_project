"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LockKeyhole, UserCircle } from "lucide-react";

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
	contentClassName?: string;
};

export function SettingsShell({
	title,
	description,
	headerTitle,
	children,
	contentClassName = "p-4 sm:p-6 lg:p-8",
}: SettingsShellProps) {
	const pathname = usePathname();

	return (
		<main className="flex min-h-screen flex-col justify-start bg-[#F0F2F5] text-slate-900">
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
					<aside className="flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
						<nav className="flex flex-1 flex-col gap-1.5">
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
