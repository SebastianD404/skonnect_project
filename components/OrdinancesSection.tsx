"use client";

import { useEffect, useState } from "react";
import { X, FileSignature, GraduationCap, Trophy, type LucideIcon } from "lucide-react";

const ordinanceData = [
  {
    id: "1-2023",
    author: "Hon. Jessica Joyce G. Laus",
    title: "Pico Youth Organizations and Associations Registration Ordinance",
    shortDesc: "Institutionalizing the registration of Pico youth organizations and providing funds thereof.",
    icon: "FileSignature",
    sections: [
      { heading: "SECTION 1. TITLE", content: "This ordinance shall be known as the “Pico Youth Organizations and Associations Registration Ordinance”." },
      { heading: "SECTION 5. FUNDING", content: "Registered organizations shall be prioritized in using Sangguniang Kabataan Fund, mainly in implementing identified programs, projects, and activities, as long as any allotment is made per existing laws, rules, and regulations." },
      { heading: "SECTION 6. PRIORITIZATION", content: "Regarding any Sangguniang Kabataan program, privilege, or incentive, registered organizations and their members shall be given priority over non-registered organizations and non-registered members. In applying this prioritization provision, only the document submitted by the organization shall be considered, provided any changes or updates made to any paper may be communicated verbally before submitting an updated copy." },
      { heading: "SECTION 7. PROCEDURAL AND DOCUMENTARY REQUIREMENTS", content: "An organization is deemed officially registered with the Sangguniang Kabataan if such an organization passes the following documents and the SK Council approves such an application:\n1. Duly accomplished application form for the organization and each member, the form of which shall be provided by the council;\n2. Roster of members and officers and their details as provided in a separate form;\n3. Identification Card with proof of residence (each member);\n4. Constitution and by-laws of the organization." },
    ],
  },
  {
    id: "2-2023",
    author: "Hon. Jessica Joyce G. Laus",
    title: "Cash Incentive Program to Honor Graduates",
    shortDesc: "Establishing the award of cash incentives to honor graduate residents of Barangay Pico for excelling in their academic accomplishments.",
    icon: "GraduationCap",
    sections: [
      { heading: "SECTION 1. TITLE", content: "This ordinance shall be known as the “Cash Incentive Program to Honor Graduates”." },
      { heading: "SECTION 5. CRITERIA FOR QUALIFICATION", content: "Applicants must satisfy the following criteria to qualify for the program:\n1. Must be a bona fide resident of Barangay Pico.\n2. Must be 15-30 years old.\n3. Must be a graduate of any school, college, or university." },
      { heading: "SECTION 6. REQUIRED DOCUMENTS", content: "All applicants shall be required to submit the following documents for verification as well as for the records of the Barangay:\n1. Letter of intent to apply to the program addressed to the SK Chairperson.\n2. Fully accomplished registration form.\n3. 1 pc 2X2 I.D picture\n4. Certified true copy of Diploma.\n5. Certified true copy of Certificate of Good Moral from the school graduated.\n6. Certified true copy of Certificate indicating that you are an honor graduate or you topped the Board or Bar examination.\n7. Certificate of Residency.\n8. Photocopy of I.D card indicating the address with three (3) specimens.\n9. Any of the following:\n   a. Certified true copy of Transcript of Record issued by the school registrar for college graduates.\n   b. Certified true copy of form 137 or 138 report card for high school graduates." },
      { heading: "SECTION 10. PRIVILEGES", content: "Qualified applicants shall be entitled to receive the following amounts:\n1. For High School students:\n   a. With Honor - ₱3,000.00\n   b. With High Honor - ₱4,000.00\n   c. With Highest Honor - ₱5,000.00\n2. For College students:\n   a. Cum Laude - ₱5,000.00\n   b. Magna Cum Laude - ₱7,500.00\n   c. Summa Cum Laude - ₱10,000.00\n3. Top 10 passer from the Board or Bar Examination - ₱15,000.00" },
    ],
  },
  {
    id: "3-2023",
    author: "Hon. Jessica Joyce G. Laus",
    title: "YOUTH SUPPORT SYSTEM PROGRAM",
    shortDesc: "Establishing a financial support program for Barangay Pico youth and youth groups participating in youth-related competitions.",
    icon: "Trophy",
    sections: [
      { heading: "SECTION 1. TITLE", content: "This ordinance shall be known as the “YOUTH SUPPORT SYSTEM PROGRAM”." },
      { heading: "SECTION 5. CRITERIA FOR QUALIFICATION", content: "Applicants must be bona fide residents of Barangay Pico aged from fifteen (15) to thirty (30) years old. In the case of mixed residencies for a youth group, the number of youth who resides in Barangay Pico will be the basis. If an applicant is competing in multiple competitions, he/she is only entitled to one compensation." },
      { heading: "SECTION 6. REQUIRED DOCUMENTS", content: "All applicants shall be required to submit the following documents for verification, as well as for the records of the Barangay:\n1. Application Form\n2. Photocopy of I.D card indicating the address with three specimens.\n3. Proof showing the participation of the youth/group:\n   a. Invitation Letter from the organizers\n   b. Verified registration form of competitor/s." },
      {
        heading: "SECTION 9. PRIVILEGES",
        content: "Qualified applicants shall be entitled to receive the following amounts:",
        table: {
          headers: ["LEVEL", "INDIVIDUAL YOUTH", "YOUTH GROUP (2-3 members)", "YOUTH GROUP (4 or more members)"],
          rows: [
            ["MUNICIPAL LEVEL/ DISTRICT LEVEL", "₱1,500.00", "₱3,500.00", "₱5,000.00"],
            ["PROVINCIAL LEVEL", "₱2,500.00", "₱4,500.00", "₱6,000.00"],
            ["REGIONAL LEVEL", "₱4,000.00", "₱6,000.00", "₱8,000.00"],
            ["NATIONAL LEVEL", "₱6,000.00", "₱8,000.00", "₱10,000.00"],
            ["INTERNATIONAL LEVEL", "₱8,000.00", "₱10,000.00", "₱12,000.00"],
          ],
        },
      },
    ],
  },
];

const iconMap: Record<string, LucideIcon> = { FileSignature, GraduationCap, Trophy };

export default function OrdinancesSection() {
  const [selectedOrdinanceId, setSelectedOrdinanceId] = useState<string | null>(null);
  const selectedOrdinance = ordinanceData.find((ordinance) => ordinance.id === selectedOrdinanceId);

  useEffect(() => {
    if (!selectedOrdinance) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedOrdinanceId(null);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedOrdinance]);

  return (
    <section id="ordinances" className="bg-white px-6 py-16 lg:px-12 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">Barangay Ordinances</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 lg:text-4xl">
            Official ordinances for youth programs
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-500">Explore the official policies that guide youth programs, incentives, and support in Barangay Pico.</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {ordinanceData.map((ordinance) => {
            const Icon = iconMap[ordinance.icon];

            return (
              <button
                key={ordinance.id}
                type="button"
                onClick={() => setSelectedOrdinanceId(ordinance.id)}
                className="group flex h-full flex-col rounded-2xl border border-slate-200/60 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-4"
                aria-label={`Read Ordinance No. ${ordinance.id}: ${ordinance.title}`}
              >
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Ordinance No. {ordinance.id}</span>
                <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-8 ring-emerald-50/60">
                  <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
                </div>
                <h3 className="mt-6 text-xl font-bold leading-snug text-slate-900">{ordinance.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">{ordinance.shortDesc}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">Read full ordinance <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span></span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedOrdinance && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ordinance-dialog-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedOrdinanceId(null);
          }}
        >
          <div className="flex max-h-[min(90vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-6 border-b border-slate-200 px-6 py-5 sm:px-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Ordinance No. {selectedOrdinance.id}</p>
                <h2 id="ordinance-dialog-title" className="mt-2 text-2xl font-bold leading-tight text-slate-900">{selectedOrdinance.title}</h2>
                <p className="mt-2 text-sm text-slate-500">Authored by {selectedOrdinance.author}</p>
              </div>
              <button type="button" onClick={() => setSelectedOrdinanceId(null)} className="shrink-0 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" aria-label="Close ordinance dialog">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
              <div className="space-y-8">
                {selectedOrdinance.sections.map((section) => (
                  <section key={section.heading}>
                    <h3 className="text-sm font-bold tracking-wide text-slate-900">{section.heading}</h3>
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{section.content}</p>
                    {section.table && (
                      <div className="mt-4 w-full overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full table-fixed border-collapse text-left text-sm text-slate-600">
                          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
                            <tr>
                              {section.table.headers.map((header, headerIndex) => (
                                <th
                                  key={header}
                                  scope="col"
                                  className={`border-b border-slate-200 px-4 py-3 font-bold ${headerIndex === 0 ? "w-[31%] text-left" : "w-[23%] text-center"}`}
                                >
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white text-slate-600">
                            {section.table.rows.map((row) => (
                              <tr key={row[0]} className="transition-colors hover:bg-emerald-50/40">
                                {row.map((cell, cellIndex) => (
                                  <td
                                    key={`${row[0]}-${cellIndex}`}
                                    className={`break-words px-4 py-3 leading-relaxed ${cellIndex === 0 ? "text-left font-semibold text-slate-800" : "text-center"}`}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}