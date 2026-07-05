"use client";

import { useEffect, useState } from "react";
import { KKProfilingRowActions } from "./KKProfilingRowActions";
import type { KKProfilingRegistration } from "./types";

const deleteRegistration = async (id: string) => {
  const response = await fetch(`/api/admin/kk-profiling/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.error || "Failed to delete registration");
  }
};

export function KKProfilingRegistrationsTable({
  registrations,
  statusLabel,
}: {
  registrations: KKProfilingRegistration[];
  statusLabel?: string;
}) {
  const [rows, setRows] = useState(registrations);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setRows(registrations);
    const timer = window.setTimeout(() => setIsLoading(false), 200);
    return () => window.clearTimeout(timer);
  }, [registrations]);

  const handleDelete = async (id: string) => {
    try {
      await deleteRegistration(id);
      setRows((current) => current.filter((row) => row.id !== id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete registration");
    }
  };

  const handleUpdate = (updatedRegistration: KKProfilingRegistration) => {
    setRows((current) =>
      current.map((row) => (row.id === updatedRegistration.id ? updatedRegistration : row))
    );
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border-4 border-slate-200 border-t-slate-950 animate-spin" />
          </div>
        )}
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">Name</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">Age group</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">Classification</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">SK Voter</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">Status</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">Submitted</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={7}>
                  No {statusLabel ? statusLabel.toLowerCase() : "registered"} KK profiles yet.
                </td>
              </tr>
            ) : (
              rows.map((registration) => (
                <tr key={registration.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-950">{registration.fullName}</div>
                    <div className="text-xs text-slate-500">{registration.email}</div>
                  </td>
                  <td className="px-4 py-4">{registration.youthAgeGroup}</td>
                  <td className="px-4 py-4">{registration.youthClassification}</td>
                  <td className="px-4 py-4">{registration.registeredSKVoter}</td>
                  <td className="px-4 py-4 capitalize text-slate-700">{registration.reviewStatus || "Pending"}</td>
                  <td className="px-4 py-4 text-slate-500">
                    {new Date(registration.submittedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-4">
                    <KKProfilingRowActions registration={registration} onDelete={handleDelete} onUpdate={handleUpdate} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
