"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

type WaitlistApplication = {
  id: string;
  waitlistPosition: number | null;
  submittedAt: string;
  applicantName: string;
  emailAddress: string;
  contactNumber: string | null;
  school: string;
  currentCourse: string;
  yearLevel: string;
};

type CapacityState = {
  activeCount: number;
  maxSlots: number;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {} as Record<string, unknown>;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text.slice(0, 300) };
  }
}

export default function SkeapWaitlistClient() {
  const [applications, setApplications] = useState<WaitlistApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<CapacityState>({ activeCount: 0, maxSlots: 55 });
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [slotLimitDraft, setSlotLimitDraft] = useState("55");
  const [savingCapacity, setSavingCapacity] = useState(false);

  async function loadWaitlist() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/skeap-applications/waitlist", { cache: "no-store" });
      const body = await readJsonResponse(response);
      if (!response.ok) throw new Error(String(body.error || "Unable to load the waitlist."));
      setApplications(Array.isArray(body.applications) ? body.applications as unknown as WaitlistApplication[] : []);
      const activeCount = typeof body.activeCount === "number" ? body.activeCount : 0;
      const maxSlots = typeof body.maxSlots === "number" ? body.maxSlots : 55;
      setCapacity({ activeCount, maxSlots });
      setSlotLimitDraft(String(maxSlots));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the waitlist.");
    } finally {
      setLoading(false);
    }
  }

  async function saveCapacity() {
    setSavingCapacity(true);
    setToastMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings/slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: Number(slotLimitDraft) }),
      });
      const body = await readJsonResponse(response);
      if (!response.ok) throw new Error(String(body.error || "Unable to update the slot limit."));
      const maxSlots = Number(body.value);
      setCapacity((current) => ({ ...current, maxSlots }));
      setSlotLimitDraft(String(maxSlots));
      setEditingCapacity(false);
      setToastMessage("SKEAP slot limit updated successfully.");
      window.setTimeout(() => setToastMessage(null), 3000);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update the slot limit.");
    } finally {
      setSavingCapacity(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadWaitlist();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function promoteApplication(application: WaitlistApplication) {
    setPromotingId(application.id);
    setToastMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/applications/${application.id}/promote`, { method: "POST" });
      const body = await readJsonResponse(response);
      if (!response.ok) throw new Error(String(body.error || "Unable to promote applicant."));
      setToastMessage(`${application.applicantName} was promoted to an active grantee.`);
      await loadWaitlist();
    } catch (promoteError) {
      setError(promoteError instanceof Error ? promoteError.message : "Unable to promote applicant.");
    } finally {
      setPromotingId(null);
    }
  }

  return (
    <main className="min-h-full space-y-6 p-6 lg:p-10">
      <header className="flex flex-col items-center justify-between gap-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:p-8">
        <div className="w-full max-w-lg flex-shrink-0 lg:w-[32rem]">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">SKEAP capacity management</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Scholarship waitlist</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Applicants are ordered by the time they joined the queue. Promote the next applicant when an active scholarship slot becomes available.
          </p>
        </div>
        <div className="flex w-full min-w-0 max-w-full flex-shrink items-center justify-start gap-2 lg:w-full lg:max-w-[440px] lg:justify-end">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-2xl font-extrabold text-[#0F3D5C]">{capacity.activeCount} / {capacity.maxSlots}</span>
            {!editingCapacity ? <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Slots</span> : null}
          </div>
          {!editingCapacity ? (
            <button type="button" onClick={() => setEditingCapacity(true)} className="h-10 whitespace-nowrap rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              Edit Slot Limit
            </button>
          ) : (
            <div className="flex min-w-0 max-w-full flex-nowrap items-center gap-2">
              <input
                type="number"
                min={1}
                max={100000}
                value={slotLimitDraft}
                onChange={(event) => setSlotLimitDraft(event.target.value)}
                className="h-9 w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                aria-label="Maximum SKEAP slots"
              />
              <button type="button" onClick={() => void saveCapacity()} disabled={savingCapacity} className="h-9 whitespace-nowrap rounded-lg bg-slate-950 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                {savingCapacity ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" onClick={() => { setEditingCapacity(false); setSlotLimitDraft(String(capacity.maxSlots)); }} disabled={savingCapacity} className="h-9 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
                Cancel
              </button>
            </div>
          )}
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800">{error}</div> : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 bg-white px-4 py-3 text-sm font-semibold text-slate-800 opacity-100 shadow-lg transition-all duration-300">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Queue</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{applications.length} waitlisted applicant{applications.length === 1 ? "" : "s"}</h2>
          </div>
          <button type="button" onClick={() => void loadWaitlist()} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">Loading waitlist...</div>
        ) : applications.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">No applicants are currently waitlisted.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-4">Position</th>
                  <th className="px-6 py-4">Applicant</th>
                  <th className="px-6 py-4">Program details</th>
                  <th className="px-6 py-4">Submitted</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((application) => (
                  <tr key={application.id} className="align-top">
                    <td className="whitespace-nowrap px-6 py-5 text-lg font-black text-slate-900">#{application.waitlistPosition ?? "-"}</td>
                    <td className="px-6 py-5">
                      <p className="font-semibold text-slate-900">{application.applicantName}</p>
                      <p className="mt-1 text-slate-500">{application.emailAddress}</p>
                      {application.contactNumber ? <p className="mt-1 text-slate-500">{application.contactNumber}</p> : null}
                    </td>
                    <td className="px-6 py-5 text-slate-600">
                      <p>{application.school}</p>
                      <p className="mt-1">{application.currentCourse} · {application.yearLevel}</p>
                    </td>
                    <td className="whitespace-nowrap px-6 py-5 text-slate-600">{formatDate(application.submittedAt)}</td>
                    <td className="whitespace-nowrap px-6 py-5 text-right">
                      <button
                        type="button"
                        onClick={() => void promoteApplication(application)}
                        disabled={promotingId !== null}
                        className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {promotingId === application.id ? "Promoting..." : "Promote to Grantee"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}