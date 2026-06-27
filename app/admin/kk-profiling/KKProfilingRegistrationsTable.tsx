"use client";

import { useEffect, useState } from "react";
import { KKProfilingRowActions } from "./KKProfilingRowActions";

interface RegistrationSummary {
  id: string;
  fullName: string;
  email: string;
  youthAgeGroup: string;
  youthClassification: string;
  registeredSKVoter: string;
  submittedAt: Date | string;
  address: string;
  sex: string;
  age: number;
  birthDate: Date | string;
  facebook: string;
  contactNumber: string;
  civilStatus: string;
  workStatus: string;
  educationalBackground: string;
  votedLastSK: string;
  registeredNationalVoter: string;
  attendedKKAssembly: string;
  assemblyTimes?: string | null;
  noAssemblyReason?: string | null;
}

const deleteRegistration = async (id: string) => {
  const response = await fetch(`/api/admin/kk-profiling/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.error || "Failed to delete registration");
  }
};

export function KKProfilingRegistrationsTable({ registrations }: { registrations: RegistrationSummary[] }) {
  const [rows, setRows] = useState(registrations);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(registrations);
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

  const handleUpdate = (updatedRegistration: RegistrationSummary) => {
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
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">Name</th>
            <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">Age group</th>
            <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">Classification</th>
            <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">SK Voter</th>
            <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">Submitted</th>
            <th className="px-4 py-3 font-semibold uppercase tracking-[0.2em]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
          {rows.map((registration) => (
            <tr key={registration.id} className="transition hover:bg-slate-50">
              <td className="px-4 py-4">
                <div className="font-medium text-slate-950">{registration.fullName}</div>
                <div className="text-xs text-slate-500">{registration.email}</div>
              </td>
              <td className="px-4 py-4">{registration.youthAgeGroup}</td>
              <td className="px-4 py-4">{registration.youthClassification}</td>
              <td className="px-4 py-4">{registration.registeredSKVoter}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
