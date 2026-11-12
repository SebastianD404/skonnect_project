import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getRecentSemesters } from "@/lib/semester";
import ReportsDashboard, { type ReportSection } from "./ReportsDashboard";

export default async function AdminReportsPage() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const semesters = getRecentSemesters();
  const currentSemester = semesters[0]?.name;
  const semesterOptions = semesters.map(({ name, label }) => ({ value: name, label }));
  const financialExportParams = new URLSearchParams({
    semester: currentSemester,
    reportType: "master_payroll",
  });
  const receivedPayoutParams = new URLSearchParams({
    semester: currentSemester,
    reportType: "received_payouts",
    payoutStatus: "received",
  });
  const pendingDocumentsParams = new URLSearchParams({
    reportType: "missing_incomplete",
    semester: currentSemester,
  });
  const nonCompliantParams = new URLSearchParams({
    reportType: "non_compliant",
  });
  const unclaimedPayoutParams = new URLSearchParams({
    semester: currentSemester,
    reportType: "unclaimed_payouts",
  });
  const inSchoolParams = new URLSearchParams({
    filter: "all_approved",
    classification: "In school Youth",
  });
  const outOfSchoolParams = new URLSearchParams({
    filter: "all_approved",
    classification: "Out of School Youth",
  });
  const reportSections: ReportSection[] = [
    {
      title: "Katipunan ng Kabataan (KK) Registry",
      description: "Census, classification, and archived youth profile exports.",
      reports: [
        {
          title: "Full KK Census Masterlist",
          description: "All approved KK profiling records.",
          href: "/api/admin/members/export?filter=all_approved",
          icon: "users",
          reportType: "STATIC",
        },
        {
          title: "In-School Youth Registry",
          description: "Approved profiles classified as in-school youth.",
          href: `/api/admin/members/export?${inSchoolParams.toString()}`,
          icon: "graduation-cap",
          reportType: "STATIC",
        },
        {
          title: "Out-of-School Youth Registry",
          description: "Approved profiles classified as out-of-school youth.",
          href: `/api/admin/members/export?${outOfSchoolParams.toString()}`,
          icon: "users",
          reportType: "STATIC",
        },
        {
          title: "SK Registered Voters Masterlist",
          description: "Youth profiles officially registered as SK voters for election compliance.",
          href: "/api/admin/members/export?filter=all_approved&skVoter=true",
          icon: "users",
          reportType: "STATIC",
        },
        {
          title: "Archived/Aged-Out Youth Records",
          description: "Archived KK profiles with archive reasons and review notes.",
          href: "/api/admin/members/records/export",
          icon: "archive",
          reportType: "ARCHIVED_RECORDS",
        },
      ],
    },
    {
      title: "SKEAP Scholarship Administration",
      description: "Scholar status, applicant waitlist, and scholarship history.",
      reports: [
        {
          title: "Active Scholars Masterlist",
          description: "Current active and probationary SKEAP scholars.",
          href: "/api/admin/grantees/export",
          icon: "badge-check",
          reportType: "STATIC",
        },
        {
          title: "Waitlisted Applicants",
          description: "Applicants ordered by their current waitlist position.",
          href: "/api/admin/skeap-applications/waitlist/export",
          icon: "clock",
          reportType: "STATIC",
        },
        {
          title: "Pending Document Submissions",
          description: "Active scholars with missing COE or grade uploads for the current semester.",
          href: `/api/admin/submissions/export?${pendingDocumentsParams.toString()}`,
          icon: "file-check",
          reportType: "PENDING_DOCUMENTS",
        },
        {
          title: "Non-Compliant Grantees Masterlist",
          description: "Active scholars who failed to submit mandatory semester requirements before the deadline.",
          href: `/api/admin/submissions/export?${nonCompliantParams.toString()}`,
          icon: "file-check",
          reportType: "PENDING_DOCUMENTS",
        },
        {
          title: "Graduated Scholars Archive",
          description: "Graduated scholars with enrollment and end-date details.",
          href: "/api/admin/grantees/records/export?status=graduated",
          icon: "history",
          reportType: "STATIC",
        },
        {
          title: "Revoked Grantees (with reasons)",
          description: "Revoked scholars with revocation dates and recorded reasons.",
          href: "/api/admin/grantees/revoked/export",
          icon: "user-x",
          reportType: "REVOKED_GRANTEES",
        },
      ],
    },
    {
      title: "Financial & Disbursement Audits",
      description: `Current-semester payroll and payout reporting for ${currentSemester}.`,
      reports: [
        {
          title: "SKEAP Financial Masterlist (Current Semester)",
          description: "Current-semester SKEAP master payroll.",
          href: `/api/admin/accounting/export?${financialExportParams.toString()}`,
          icon: "banknote",
          reportType: "SKEAP_FINANCIAL",
          semesterOptions,
        },
        {
          title: "Cash Disbursement Payout Receipts",
          description: "Current-semester payouts recorded as received/disbursed.",
          href: `/api/admin/accounting/export?${receivedPayoutParams.toString()}`,
          icon: "file-check",
          reportType: "SKEAP_FINANCIAL",
          semesterOptions,
        },
        {
          title: "Unclaimed SKEAP Allowances",
          description: "Approved scholars who have not yet claimed their physical cash payout.",
          href: `/api/admin/accounting/export?${unclaimedPayoutParams.toString()}`,
          icon: "banknote",
          reportType: "STATIC",
        },
      ],
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 text-slate-950">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-700">
          Reports &amp; Exports
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Generate Reports</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
          Find and download prepared reports for KK registry, SKEAP administration, and financial audits.
        </p>
      </header>

      <ReportsDashboard sections={reportSections} />
    </div>
  );
}
