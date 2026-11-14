import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Bot,
  ChevronRight,
  FileCheck2,
  Headset,
  Home,
  MessageSquarePlus,
  UserCheck,
} from "lucide-react";
import ProgramApplyClient from "@/app/programs/ProgramApplyClient";
import AdminInquiryModal from "@/app/programs/AdminInquiryModal";
import ProgramActionButton from "@/app/programs/ProgramActionButton";
import ProgramTableOfContents from "@/app/programs/ProgramTableOfContents";
import KKProfilingForm from "@/app/programs/kk-profiling-form";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

const overviewIcons = [BarChart3, FileCheck2, Headset];
const actionRowClass =
  "group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100/80 hover:text-slate-900";
const actionIconClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-white";

type Props = { params: Promise<{ slug: string | string[] }> };

type ProgramStatus = {
  badge: string;
  label: string;
  summary: string;
  activeScholars: number;
  totalScholars: number;
  nextReview: string;
  deadline: string;
};

type ProgramRequirement = string | {
  label: string;
  detail?: string;
  linkedFromKkProfile?: boolean;
};

type ProgramProcessStep = {
  title: string;
  description: string;
};

async function getProgramStatus(slug: string): Promise<ProgramStatus | null> {
  try {
    const response = await fetch(`/api/programs/${slug}/status`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

type ProgramPageData = {
  title: string;
  subtitle: string;
  overview?: string;
  hero?: string;
  features: { title: string; detail: string }[];
  statusTypes?: { title: string; description: string }[];
  faq: { q: string; a: string }[];
  cta: { label: string; href: string }[];
  howItWorks?: Array<string | ProgramProcessStep>;
  requirements?: ProgramRequirement[];
  requirementsCallout?: string;
};

const PROGRAMS: Record<string, ProgramPageData> = {
  "skeap-scholarship": {
    title: "Sangguniang Kabataan Educational Assistance Program (SKEAP)",
    subtitle: "Barangay Pico's official youth assistance program for qualified residents.",
    overview:
      "The Sangguniang Kabataan Educational Assistance Program (SKEAP) supports Barangay Pico scholars with transparent status tracking, academic accountability, and semester-based financial assistance.",
    hero: "/brgyhall.jpeg",
    features: [
      { title: "Clear scholar status", detail: "Monitor Active, Probationary, or Graduated status from your dashboard." },
      { title: "Document-ready workflow", detail: "Submit your required application documents securely in one place." },
      { title: "Community-first support", detail: "Receive reminders, review updates, and direct helpdesk guidance." },
    ],
    statusTypes: [
      { title: "Active Scholar", description: "Fully qualified students receiving regular scholarship support while maintaining the SKEAP requirements." },
      { title: "Probationary Scholar", description: "Students under review who must submit missing documents or improve academic standing." },
      { title: "Graduated Scholar", description: "Alumni who completed their scholarship cycle and remain eligible for follow-up support." },
      { title: "Removed Scholar", description: "Students who were removed from the program due to ineligibility, withdrawal, or other administrative reasons. Removed scholars are not currently receiving benefits." },
    ],
    howItWorks: [
      {
        title: "Complete KK Profile & Apply Online",
        description:
          "Complete your Katipunan ng Kabataan (KK) Profile and submit the online SKEAP application along with your required digital documents.",
      },
      {
        title: "Digital Screening & Physical CTC Verification",
        description:
          "SK officials conduct digital screening of your uploaded files. Once pre-qualified, you will be notified to present original copies and Certified True Copies (CTCs) at the Barangay Pico Hall for final verification.",
      },
      {
        title: "Approval & Payout Tracking",
        description:
          "Verified and approved scholars receive confirmation and can track their grant and payout status directly in the SKonnect portal.",
      },
      {
        title: "Semestral Renewal",
        description:
          "Submit updated enrollment and grade requirements each semester to maintain your active grantee eligibility.",
      },
    ],
    requirements: [
      {
        label: "PSA Birth Certificate",
        detail: "Identity & age verification",
        linkedFromKkProfile: true,
      },
      {
        label: "Barangay Certificate of Residency",
        detail: "At least 1 year in Barangay Pico",
        linkedFromKkProfile: true,
      },
      {
        label: 'Latest 2"×2" I.D. Picture',
        detail: "Attached from KK Profile",
        linkedFromKkProfile: true,
      },
      {
        label: "Certificate of Low-Income",
        detail: 'Stating purpose: "Sangguniang Kabataan Educational Assistance Program"',
      },
      {
        label: "Certificate of Enrollment",
        detail: "Current Semester / School Year",
      },
      {
        label: "Certified True Copy of Grades / Form 138",
        detail: "Minimum grade of at least 80 with no failing marks",
      },
      {
        label: "COMELEC Voter's Certificate (Barangay Pico)",
        detail: "Applicant if 18+, or Parent/Guardian if aged 15–17",
      },
    ],
    requirementsCallout:
      "Original copies and Certified True Copies (CTCs) of all required documents—including those linked from the KK Profile—must be presented at Barangay Pico Hall after online pre-qualification.",
    faq: [
      {
        q: "Who can apply for SKEAP?",
        a: "Bona fide residents of Barangay Pico for at least one (1) year, aged 15 to 30 years old, belonging to a low-income family, with a minimum grade of at least 80, not receiving any other government or NGO scholarship, and duly registered voters of Barangay Pico (applicants aged 18+ must be registered voters themselves; applicants aged 15–17 may qualify through a registered voter parent or guardian).",
      },
      {
        q: "What documents should I submit?",
        a: "Upload your Certificate of Low-Income (stating the SKEAP purpose), Certificate of Enrollment, Certified Grades/Form 138, and Barangay Pico COMELEC Voter's Certificate online. Your PSA Birth Certificate, Certificate of Residency, and 2\"×2\" ID photo are automatically linked from your verified KK Profile. After online pre-qualification, you must present the original copies and Certified True Copies (CTCs) at the Barangay Pico Hall for final approval.",
      },
      {
        q: "How do I know if my application was received and approved?",
        a: "Track your real-time application status in the Applications tab (Pending Review → For Physical CTC → Approved or Waitlisted). You will also receive portal notifications when your online files are pre-qualified for physical CTC inspection at the Barangay Hall.",
      },
      {
        q: "What is the minimum grade requirement to qualify for SKEAP?",
        a: "Under Section 3(4) of the Barangay Pico SKEAP Ordinance, applicants must maintain a minimum grade of at least 80 (or its equivalent) with no failing grades.",
      },
    ],
    cta: [
      { label: "Start KK Profiling", href: "/programs/kk-profiling" },
    ],
  },
  "event-registration": {
    title: "Event Registration",
    subtitle: "Register for community and youth events, with live availability and reminders.",
    hero: "/events-hero.jpg",
    features: [
      { title: "Live Slots", detail: "See remaining slots update in real time." },
      { title: "Fast Checkout", detail: "Reserve your seat in seconds — no paper forms." },
      { title: "Reminders", detail: "Automatic reminders and calendar invites." },
    ],
    howItWorks: [
      "Browse upcoming events and open an event detail page.",
      "Select available slots and confirm your registration.",
      "Receive an email confirmation and calendar invite.",
    ],
    requirements: ["A registered SKonnect account to reserve a slot."],
    faq: [
      { q: "How do I register?", a: "Click Register on an event page and confirm your details." },
      { q: "Can I cancel?", a: "Yes — cancellations before the cutoff release your slot to waiting users." },
    ],
    cta: [{ label: "Browse programs", href: "/programs" }],
  },
  "automated-reminders": {
    title: "Automated Reminders",
    subtitle: "Never miss a deadline — get notifications for applications and events.",
    features: [
      { title: "Email & SMS", detail: "Choose how you want to be notified." },
      { title: "Custom schedules", detail: "Set reminder windows that fit your routine." },
      { title: "Reliable Delivery", detail: "Delivered on time, every time." },
    ],
    howItWorks: [
      "Opt in to reminders from your account settings.",
      "Choose channels (email, SMS) and which events or deadlines to follow.",
      "Receive notifications according to your preferences.",
    ],
    requirements: ["An SKonnect account and a verified contact method (email or phone)."],
    faq: [
      { q: "How do I enable reminders?", a: "Enable notifications from your account preferences and select channels." },
      { q: "Can I opt-out?", a: "Yes — you can disable reminders anytime in settings." },
    ],
    cta: [{ label: "Manage notification settings", href: "/profile" }],
  },
  "multilingual-helpdesk": {
    title: "Multilingual Helpdesk",
    subtitle: "Ask in English, Filipino, or Ilocano — get accurate, helpful answers fast.",
    features: [
      { title: "Multiple Languages", detail: "Support in English, Filipino, and Ilocano." },
      { title: "24/7 Access", detail: "Answers and triage available any hour, any day." },
      { title: "Contextual Help", detail: "Responses include links to relevant forms and events." },
    ],
    howItWorks: [
      "Open the helpdesk and type your question or select a topic.",
      "Receive instant automated guidance; escalate to an operator if needed.",
      "Get links to forms, events, and account settings as part of responses.",
    ],
    requirements: ["No signup required for basic help; sign-in improves personalized responses."],
    faq: [
      { q: "Is this an AI bot or live operator?", a: "It starts with automated answers and escalates to a human operator when needed." },
      { q: "What topics can it help with?", a: "Scholarships, events, account access, and general community questions." },
    ],
    cta: [{ label: "Start a conversation", href: "#ai-chatbot" }],
  },
  "kk-profiling": {
    title: "Katipunan ng Kabataan (KK) Profiling",
    subtitle: "Register as a member of the Katipunan ng Kabataan (KK) in Barangay Pico. Profiling helps the barangay understand youth demographics and ensure your voice is part of community planning.",
    overview:
      "Provide basic profile information so Barangay Pico can count youth membership and include you in upcoming initiatives.",
    hero: "/brgyhall.jpeg",
    features: [
      { title: "Community representation", detail: "Make sure your voice is heard in youth planning and programs." },
      { title: "Profile access", detail: "Update your information any time from your SKonnect account." },
      { title: "Privacy-first", detail: "Profile data is used only for community programs and not shared publicly." },
    ],
    howItWorks: [
      "Fill out the short profiling form below.",
      "Staff will verify your residency and membership.",
      "You'll receive confirmation when your KK profile is active.",
    ],
    requirements: ["Full name", "Date of birth", "Contact number or email", "Proof of residency (optional)"],
    faq: [
      { q: "Who can register?", a: "Any youth resident of Barangay Pico eligible to join the Katipunan ng Kabataan." },
      { q: "Is my data private?", a: "Yes — data is used for program administration and not published publicly." },
    ],
    cta: [{ label: "Start profiling", href: "#kk-profiling-form" }],
  },
};

export default async function ProgramPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const data = slug ? PROGRAMS[slug] : undefined;

  // Determine current user's role (server-side). If not signed in or role is
  // `YOUTH`, we will hide board-only program status details.
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  const appUser = supabaseUser ? await ensureProfile(supabaseUser) : null;

  if (slug === "kk-profiling" && !supabaseUser) {
    redirect("/signup?next=%2Fprograms%2Fkk-profiling");
  }

  let shouldRedirectToKkStatus = false;

  if (slug === "kk-profiling" && appUser) {
    const userWithKkData = await prisma.user.findUnique({
      where: { id: appUser.id },
      select: {
        kkProfile: {
          select: {
            isVerified: true,
          },
        },
        profilingRegistrations: {
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: {
            reviewStatus: true,
          },
        },
      },
    });

    const latestStatus =
      userWithKkData?.profilingRegistrations?.[0]?.reviewStatus ||
      (userWithKkData?.kkProfile?.isVerified ? "Approved" : undefined);

    if (latestStatus && latestStatus.toLowerCase().includes("approved")) {
      shouldRedirectToKkStatus = true;
    }
  }

  if (shouldRedirectToKkStatus) {
    redirect("/programs/kk-profiling/status");
  }

  const showStatusSection = Boolean(appUser && appUser.role !== Role.YOUTH);
  const status = slug && showStatusSection ? await getProgramStatus(slug) : null;

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA]">
        <div className="max-w-2xl text-center">
          <h1 className="text-3xl font-bold mb-4 text-[#0F3D5C]">Program not found</h1>
          <p className="text-sm text-slate-600 mb-6">We couldn't find the program you're looking for.</p>
          <Link href="/" className="inline-block rounded-lg bg-[#0F3D5C] text-white px-4 py-2 font-semibold">Back to home</Link>
        </div>
      </div>
    );
  }

  const tocSections = [
    { id: "overview", index: "01", label: "Overview" },
    ...(data.howItWorks
      ? [{ id: "how-it-works", index: "02", label: "How it works" }]
      : []),
    ...(data.requirements
      ? [{ id: "requirements", index: "03", label: "Requirements" }]
      : []),
    { id: "faq", index: "04", label: "FAQ" },
  ];

  return (
    <div className="min-h-screen bg-[#F3F7FB] text-slate-900">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <AdminInquiryModal
          subject={slug === "skeap-scholarship" ? "SKEAP Application Inquiry" : `${data.title} Inquiry`}
          returnTo={`/programs/${slug}`}
        />
        <div className="mb-4 flex items-center gap-2 text-sm">
          <Link href="/" className="text-slate-500 transition hover:text-slate-900">
            Home
          </Link>
          <span className="text-slate-400">/</span>
          <Link href="/#programs" className="text-slate-500 transition hover:text-slate-900">
            Programs
          </Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500">SKEAP</span>
        </div>

        <div className="mb-8 rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-600">Scholarship program</p>
              <h1 className="relative max-w-none text-4xl font-medium tracking-tight text-slate-900 sm:text-5xl sm:leading-tight">
                {slug === "skeap-scholarship" ? (
                  <>
                    <span className="absolute -left-12 top-0 h-36 w-[42rem] rounded-full bg-yellow-200/50 blur-3xl animate-pulse" style={{ animationDuration: "14s" }} />
                    <span className="relative block font-semibold text-blue-900">
                      <span className="text-blue-900">Sangguniang</span>{" "}
                      <span className="text-red-700">Kabataan</span>{" "}
                      <span className="text-slate-900 font-normal">Educational Assistance Program (</span>
                      <span className="text-blue-900 font-semibold">S</span>
                      <span className="text-red-700 font-semibold">K</span>
                      <span className="font-semibold text-slate-900">EAP)</span>
                    </span>
                  </>
                ) : slug === "kk-profiling" ? (
                  <span className="block">
                    <span className="text-blue-900">Katipunan ng Kabataan</span>{" "}
                    <span className="text-blue-900">(KK)</span>{" "}
                    <span className="text-red-800">Profiling</span>
                  </span>
                ) : (
                  data.title
                )}
              </h1>
              <p className="max-w-3xl text-base leading-8 text-slate-600">{data.subtitle}</p>
            </div>

            {slug !== "kk-profiling" && (
              <div className="flex flex-wrap gap-3">
                <ProgramApplyClient slug={slug} />
                <ProgramActionButton
                  action="admin-inquiry"
                  className="inline-flex min-w-[220px] items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Get application help →
                </ProgramActionButton>
              </div>
            )}
          </div>
        </div>
        
        {slug === "kk-profiling" && (
          <div id="kk-profiling-form" className="mb-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <KKProfilingForm />
          </div>
        )}

        {slug !== "kk-profiling" && (
        <section className="grid gap-8 xl:grid-cols-[1.6fr_0.9fr]">
          <div className="space-y-8">
            {showStatusSection && (
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="grid gap-6 sm:grid-cols-3">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition duration-300 hover:shadow-md hover:border-slate-300 hover:-translate-y-1">
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{status?.badge ?? "Program status"}</p>
                    <h2 className="mt-3 text-lg font-semibold text-slate-900">{status?.label ?? "Status updated"}</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{status?.summary ?? "Live SKEAP status is updating."}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition duration-300 hover:shadow-md hover:border-slate-300 hover:-translate-y-1">
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Next review</p>
                    <p className="mt-3 text-xl font-semibold text-slate-900">{status?.nextReview ?? "TBA"}</p>
                    <p className="mt-2 text-sm text-slate-500">Deadline: {status?.deadline ?? "TBA"}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition duration-300 hover:shadow-md hover:border-slate-300 hover:-translate-y-1">
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Active scholars</p>
                    <p className="mt-3 text-3xl font-semibold text-slate-900">{status?.activeScholars ?? "—"}</p>
                    <div className="mt-3 h-2 rounded-full bg-slate-200">
                      {(() => {
                        const active = status?.activeScholars ?? 0;
                        const total = status?.totalScholars ?? 0;
                        const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((active / total) * 100))) : 0;

                        return (
                          <div
                            className="h-2 rounded-full bg-teal-500"
                            role="progressbar"
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            style={{ width: `${pct}%` }}
                          />
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <section id="overview" className="scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-4 text-sm uppercase tracking-[0.35em] text-teal-600">
                <span className="rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-700">01</span>
                <span>Overview</span>
              </div>
              <h2 className="mt-6 text-3xl font-bold text-slate-900">Overview</h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">{data.overview ?? data.subtitle}</p>
              <div className="mt-8 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
                {data.features.map((feature, index) => (
                  <div key={feature.title} className="flex h-full flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const Icon = overviewIcons[index] ?? Headset;
                        return (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                        );
                      })()}
                      <p className="text-sm font-semibold text-slate-900">{feature.title}</p>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-600">{feature.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Scholar status section removed as requested */}

            {data.howItWorks && (
              <section id="how-it-works" className="scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-center gap-4 text-sm uppercase tracking-[0.35em] text-teal-600">
                  <span className="rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-700">02</span>
                  <span>How it works</span>
                </div>
                <h2 className="mt-6 text-3xl font-bold text-slate-900">How it works</h2>
                <ol className="mt-8">
                  {data.howItWorks.map((step, index) => {
                    const title = typeof step === "string" ? `Step ${index + 1}` : step.title;
                    const description = typeof step === "string" ? step : step.description;
                    return (
                      <li
                        key={`${title}-${index}`}
                        className="relative pl-11 pb-7 last:pb-0 before:absolute before:left-[15px] before:top-8 before:h-[calc(100%-2rem)] before:w-px before:bg-slate-200 last:before:hidden"
                      >
                        <span className="absolute left-0 top-0 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                          {index + 1}
                        </span>
                        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {data.requirements && (
              <section id="requirements" className="scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-center gap-4 text-sm uppercase tracking-[0.35em] text-teal-600">
                  <span className="rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-700">03</span>
                  <span>Requirements</span>
                </div>
                <h2 className="mt-6 text-3xl font-bold text-slate-900">Requirements</h2>
                {data.requirements.some((requirement) =>
                  typeof requirement !== "string" && requirement.linkedFromKkProfile
                ) ? (
                  <>
                    <p className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Auto-Linked from Your KK Profile
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {data.requirements
                        .filter((requirement) =>
                          typeof requirement !== "string" && requirement.linkedFromKkProfile
                        )
                        .map((requirement, index) => {
                          if (typeof requirement === "string") return null;
                          return (
                            <article
                              key={`${requirement.label}-${index}`}
                              className="min-h-36 rounded-2xl border border-slate-200/80 bg-white p-4"
                            >
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                  <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-8 8a1 1 0 01-1.415 0l-4-4A1 1 0 114.29 9.29l3.293 3.294 7.707-7.293a1 1 0 011.414 0Z" clipRule="evenodd" />
                                </svg>
                                On File
                              </span>
                              <h3 className="mt-3 text-sm font-semibold leading-5 text-slate-900">
                                {requirement.label}
                              </h3>
                              {requirement.detail ? (
                                <p className="mt-1 text-xs leading-relaxed text-slate-500">{requirement.detail}</p>
                              ) : null}
                            </article>
                          );
                        })}
                    </div>

                    <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Required Digital Uploads
                    </p>
                    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                      {data.requirements
                        .filter((requirement) =>
                          typeof requirement === "string" || !requirement.linkedFromKkProfile
                        )
                        .map((requirement, index) => {
                          const label = typeof requirement === "string" ? requirement : requirement.label;
                          const detail = typeof requirement === "string" ? undefined : requirement.detail;
                          return (
                            <article
                              key={`${label}-${index}`}
                              className="flex min-h-28 items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4"
                            >
                              <svg className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V14" />
                              </svg>
                              <div className="min-w-0">
                                <h3 className="text-sm font-semibold leading-5 text-slate-900">{label}</h3>
                                {detail ? (
                                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{detail}</p>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}
                    </div>
                  </>
                ) : (
                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    {data.requirements.map((requirement, index) => {
                      const label = typeof requirement === "string" ? requirement : requirement.label;
                      const detail = typeof requirement === "string" ? undefined : requirement.detail;
                      return (
                        <div key={`${label}-${index}`} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition duration-300 hover:shadow-md hover:border-slate-300 hover:-translate-y-1">
                          <div className="flex items-start gap-3">
                            <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-6 text-slate-700">{label}</p>
                              {detail ? <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p> : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {data.requirementsCallout ? (
                  <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-900" role="note">
                    <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3h.008v.008H12v-.008ZM10.3 4.9 2.9 18a1.5 1.5 0 0 0 1.3 2.25h15.6a1.5 1.5 0 0 0 1.3-2.25L13.7 4.9a2 2 0 0 0-3.4 0Z" />
                    </svg>
                    <p className="leading-6">
                      <strong>In-Person Verification Required:</strong> {data.requirementsCallout}
                    </p>
                  </div>
                ) : null}
              </section>
            )}

            <section id="faq" className="scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-4 text-sm uppercase tracking-[0.35em] text-teal-600">
                <span className="rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-700">04</span>
                <span>FAQ</span>
              </div>
              <h2 className="mt-6 text-3xl font-bold text-slate-900">Frequently asked questions</h2>
              <div className="mt-8 space-y-4">
                {data.faq.map((qa) => (
                  <details key={qa.q} className="group rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 duration-300 open:bg-white transition hover:shadow-md hover:border-slate-300">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-slate-900 transition">
                      {qa.q}
                      <svg className="h-4 w-4 text-slate-400 transition group-open:-rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </summary>
                    <p className="mt-4 text-sm leading-7 text-slate-600">{qa.a}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>

          <aside className="self-start space-y-6 lg:sticky lg:top-24">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:shadow-md hover:border-slate-300">
              <ProgramTableOfContents sections={tocSections} />
            </div>

            <div className="rounded-[2rem] border border-slate-800/30 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-6 shadow-sm shadow-slate-400/10">
              <p className="text-xs uppercase tracking-[0.35em] text-teal-300">AI CHATBOT</p>
              <h3 className="mt-4 text-xl font-semibold tracking-tight text-white">Ask SKonnect AI</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Get instant 24/7 answers about SKEAP eligibility, grade rules, and required documents.
              </p>
              <ProgramActionButton
                action="chatbot"
                className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                <Bot className="mr-2 h-4 w-4" aria-hidden="true" />
                Chat with AI Assistant
              </ProgramActionButton>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:shadow-md hover:border-slate-300">
              <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">Quick actions</h3>
              <div className="mt-4 flex flex-col gap-1.5">
                {slug === "skeap-scholarship" ? (
                  <>
                    <Link href="/programs/kk-profiling" className={actionRowClass}>
                      <span className="flex items-center gap-3">
                        <span className={actionIconClass}><UserCheck className="h-4 w-4" aria-hidden="true" /></span>
                        Start KK Profiling
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </Link>
                    <ProgramActionButton action="admin-inquiry" className={actionRowClass}>
                      <span className="flex items-center gap-3">
                        <span className={actionIconClass}><MessageSquarePlus className="h-4 w-4" aria-hidden="true" /></span>
                        Ask SK Admin
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </ProgramActionButton>
                    <Link href="/" className={actionRowClass}>
                      <span className="flex items-center gap-3">
                        <span className={actionIconClass}><Home className="h-4 w-4" aria-hidden="true" /></span>
                        Back to Home
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </Link>
                  </>
                ) : (
                  <>
                    {data.cta.map((cta) => cta.href === "#ai-chatbot" ? (
                      <ProgramActionButton
                        key={cta.href}
                        action="chatbot"
                        className={actionRowClass}
                      >
                        <span>{cta.label}</span>
                        <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      </ProgramActionButton>
                    ) : cta.href === "/signup" ? (
                      supabaseUser ? (
                        <div key={cta.href} className={actionRowClass}>
                          <ProgramApplyClient slug={slug} />
                        </div>
                      ) : (
                        <Link
                          key={cta.href}
                          href={`/signup?next=${encodeURIComponent(`/programs/${slug}?openApply=1`)}`}
                          className={actionRowClass}
                        >
                          <span>{cta.label}</span>
                          <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        </Link>
                      )
                    ) : (
                      <Link key={cta.href} href={cta.href} className={actionRowClass}>
                        <span>{cta.label}</span>
                        <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      </Link>
                    ))}
                    <Link href="/" className={actionRowClass}>
                      <span className="flex items-center gap-3">
                        <span className={actionIconClass}><Home className="h-4 w-4" aria-hidden="true" /></span>
                        Back to Home
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </Link>
                  </>
                )}
              </div>
            </div>
          </aside>
        </section>
        )}
      </main>
    </div>
  );
}
