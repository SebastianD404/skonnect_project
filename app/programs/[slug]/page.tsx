import Link from "next/link";

type Props = { params: Promise<{ slug: string | string[] }> };

type ProgramStatus = {
  badge: string;
  label: string;
  summary: string;
  activeScholars: number;
  nextReview: string;
  deadline: string;
};

async function getProgramStatus(slug: string): Promise<ProgramStatus | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const response = await fetch(new URL(`/api/programs/${slug}/status`, baseUrl).toString(), {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
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
  howItWorks?: string[];
  requirements?: string[];
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
      { title: "Document-ready workflow", detail: "Upload enrollment certificates, grades, and IDs in one secure place." },
      { title: "Community-first support", detail: "Receive reminders, review updates, and direct helpdesk guidance." },
    ],
    statusTypes: [
      { title: "Active Scholar", description: "Fully qualified students receiving regular scholarship support while maintaining the SKEAP requirements." },
      { title: "Probationary Scholar", description: "Students under review who must submit missing documents or improve academic standing." },
      { title: "Graduated Scholar", description: "Alumni who completed their scholarship cycle and remain eligible for follow-up support." },
    ],
    howItWorks: [
      "Complete your SKonnect profile and submit the required enrollment documents.",
      "SKEAP staff review submissions, verify residency, and confirm academic eligibility.",
      "Approved scholars receive confirmation and can track disbursement status in the portal.",
      "Keep your records up to date each semester to remain eligible for ongoing support.",
    ],
    requirements: [
      "Application form",
      "Birth Certificate / Valid ID",
      "Barangay Certificate of Residency",
      "Certificate of Enrollment",
      "Latest grade report / Transcript of Records",
      "Family income certificate or income tax return",
    ],
    faq: [
      {
        q: "Who can apply for SKEAP?",
        a: "Barangay Pico youth enrolled in school who meet the SK scholarship criteria may apply. Proof of residency and enrollment are required.",
      },
      {
        q: "What documents should I submit?",
        a: "Submit a Certificate of Enrollment, recent grades, a valid ID, and proof of residency. Additional paperwork may be requested during review.",
      },
      {
        q: "How soon will I know my status?",
        a: "Applications are typically reviewed within 5 business days. Status updates are sent through SKonnect and the contact method you provide.",
      },
      {
        q: "What happens if I am placed on probation?",
        a: "Probationary scholars are notified of missing documents or eligibility gaps. Complete the requested updates quickly to return to Active status.",
      },
    ],
    cta: [
      { label: "Apply for SKEAP", href: "/signup" },
      { label: "Get application help", href: "/chatbot" },
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
    cta: [{ label: "Browse events", href: "/events" }],
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
    cta: [{ label: "Manage notification settings", href: "/account" }],
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
    cta: [{ label: "Start a conversation", href: "/chatbot" }],
  },
};

export default async function ProgramPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const data = slug ? PROGRAMS[slug] : undefined;
  const status = slug ? await getProgramStatus(slug) : null;

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

  return (
    <div className="min-h-screen bg-[#F3F7FB] text-slate-900">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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
                ) : (
                  data.title
                )}
              </h1>
              <p className="max-w-3xl text-base leading-8 text-slate-600">{data.subtitle}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex min-w-[220px] items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.16)] transition hover:bg-slate-800"
              >
                Apply for SKEAP →
              </Link>
              <Link
                href="/chatbot"
                className="inline-flex min-w-[220px] items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
              >
                Get application help →
              </Link>
            </div>
          </div>
        </div>

        <section className="grid gap-8 xl:grid-cols-[1.6fr_0.9fr]">
          <div className="space-y-8">
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
                    <div className="h-2 w-3/4 rounded-full bg-teal-500" />
                  </div>
                </div>
              </div>
            </div>

            <div id="overview" className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-4 text-sm uppercase tracking-[0.35em] text-teal-600">
                <span className="rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-700">01</span>
                <span>Overview</span>
              </div>
              <h2 className="mt-6 text-3xl font-bold text-slate-900">Overview</h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">{data.overview ?? data.subtitle}</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {data.features.map((feature, index) => (
                  <div key={feature.title} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition duration-300 hover:shadow-md hover:border-slate-300 hover:-translate-y-1">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-900 shadow-sm">0{index + 1}</span>
                      <p className="text-sm font-semibold text-slate-900">{feature.title}</p>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-600">{feature.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {data.statusTypes && (
              <div id="status" className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-center gap-4 text-sm uppercase tracking-[0.35em] text-teal-600">
                  <span className="rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-700">02</span>
                  <span>Scholar status explained</span>
                </div>
                <h2 className="mt-6 text-3xl font-bold text-slate-900">Scholar status explained</h2>
                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  {data.statusTypes.map((statusType) => {
                    const badgeColor =
                      statusType.title === "Active Scholar"
                        ? "bg-emerald-500"
                        : statusType.title.includes("Probation")
                        ? "bg-amber-500"
                        : "bg-slate-500";
                    const badgeText = statusType.title === "Active Scholar" ? "ACTIVE" : statusType.title.includes("Probation") ? "PROBATIONARY" : "GRADUATED";

                    const badgeBg =
                      statusType.title === "Active Scholar"
                        ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                        : statusType.title.includes("Probation")
                        ? "bg-amber-50 border-amber-100 text-amber-700"
                        : "bg-sky-50 border-sky-100 text-sky-700";
                    const badgeDot =
                      statusType.title === "Active Scholar"
                        ? "bg-emerald-500"
                        : statusType.title.includes("Probation")
                        ? "bg-amber-500"
                        : "bg-sky-500";

                    return (
                      <div key={statusType.title} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-6 transition duration-300 hover:shadow-md hover:border-slate-300 hover:-translate-y-1">
                        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.45em] shadow-sm ${badgeBg}`}>
                          <span className={`h-2.5 w-2.5 rounded-full ${badgeDot}`} />
                          <span className="tracking-[0.45em]">{badgeText}</span>
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-slate-900">{statusType.title}</h3>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{statusType.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {data.howItWorks && (
              <div id="how-it-works" className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-center gap-4 text-sm uppercase tracking-[0.35em] text-teal-600">
                  <span className="rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-700">03</span>
                  <span>How it works</span>
                </div>
                <h2 className="mt-6 text-3xl font-bold text-slate-900">How it works</h2>
                <ol className="mt-8 space-y-4">
                  {data.howItWorks.map((step, index) => (
                    <li key={index} className="flex gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition duration-300 hover:shadow-md hover:border-slate-300 hover:-translate-y-1">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white shadow-sm">{index + 1}</span>
                      <p className="text-sm leading-7 text-slate-600">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {data.requirements && (
              <div id="requirements" className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-center gap-4 text-sm uppercase tracking-[0.35em] text-teal-600">
                  <span className="rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-700">04</span>
                  <span>Requirements</span>
                </div>
                <h2 className="mt-6 text-3xl font-bold text-slate-900">Requirements</h2>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {data.requirements.map((requirement, index) => (
                    <div key={index} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition duration-300 hover:shadow-md hover:border-slate-300 hover:-translate-y-1">
                      <div className="flex items-start gap-3">
                        <svg className="h-5 w-5 flex-shrink-0 text-emerald-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm leading-6 text-slate-600">{requirement}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div id="faq" className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-4 text-sm uppercase tracking-[0.35em] text-teal-600">
                <span className="rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-700">05</span>
                <span>FAQ</span>
              </div>
              <h2 className="mt-6 text-3xl font-bold text-slate-900">Frequently asked questions</h2>
              <div className="mt-8 space-y-4">
                {data.faq.map((qa) => (
                  <details key={qa.q} className="group rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 duration-300 open:bg-white transition hover:shadow-md hover:border-slate-300">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-slate-900 transition">
                      {qa.q}
                      <span className="text-slate-400 transition group-open:rotate-180">+</span>
                    </summary>
                    <p className="mt-4 text-sm leading-7 text-slate-600">{qa.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>

          <aside className="sticky top-24 self-start space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:shadow-md hover:border-slate-300">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">On this page</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li><a href="#overview" className="hover:text-slate-900">Overview</a></li>
                <li><a href="#status" className="hover:text-slate-900">Scholar status</a></li>
                <li><a href="#how-it-works" className="hover:text-slate-900">How it works</a></li>
                <li><a href="#requirements" className="hover:text-slate-900">Requirements</a></li>
                <li><a href="#faq" className="hover:text-slate-900">FAQ</a></li>
              </ul>
            </div>

            <div className="rounded-[2rem] border border-slate-800/30 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-6 shadow-sm shadow-slate-400/10">
              <p className="text-xs uppercase tracking-[0.35em] text-teal-300">Help desk</p>
              <h3 className="mt-4 text-xl font-semibold tracking-tight text-white">Need help?</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">Start a conversation with our helpdesk for step-by-step assistance.</p>
              <Link
                href="/chatbot"
                className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Chat now →
              </Link>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:shadow-md hover:border-slate-300">
              <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">Quick actions</h3>
              <div className="mt-4 space-y-3">
                {data.cta.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    {c.label}
                    <span className="text-slate-400">→</span>
                  </Link>
                ))}
                <Link
                  href="/"
                  className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  Back to home
                </Link>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
