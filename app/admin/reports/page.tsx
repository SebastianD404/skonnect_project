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
  });
  const receivedPayoutParams = new URLSearchParams({
    semester: currentSemester,
  });
  const pendingDocumentsParams = new URLSearchParams({
    semester: currentSemester,
  });
  const unclaimedPayoutParams = new URLSearchParams({
    semester: currentSemester,
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
          href: "/api/admin/reports/export?type=full_kk_census&filter=all_approved",
          reportKey: "full_kk_census",
          icon: "users",
          reportType: "STATIC",
        },
        {
          title: "In-School Youth Registry",
          description: "Approved profiles classified as in-school youth.",
          href: `/api/admin/reports/export?type=in_school_registry&${inSchoolParams.toString()}`,
          reportKey: "in_school_registry",
          icon: "graduation-cap",
          reportType: "STATIC",
        },
        {
          title: "Out-of-School Youth Registry",
          description: "Approved profiles classified as out-of-school youth.",
          href: `/api/admin/reports/export?type=out_of_school_registry&${outOfSchoolParams.toString()}`,
          reportKey: "out_of_school_registry",
          icon: "users",
          reportType: "STATIC",
        },
        {
          title: "SK Registered Voters Masterlist",
          description: "Youth profiles officially registered as SK voters for election compliance.",
          href: "/api/admin/reports/export?type=sk_registered_voters&filter=all_approved&skVoter=true",
          reportKey: "sk_registered_voters",
          icon: "users",
          reportType: "STATIC",
        },
        {
          title: "Demographic Distribution (Gender & Sitio)",
          description: "Verified youth counts by sitio, with male, female, and overall totals.",
          href: "/api/admin/reports/export?type=demographic_distribution",
          reportKey: "demographic_distribution",
          icon: "users",
          reportType: "STATIC",
        },
        {
          title: "Archived/Aged-Out Youth Records",
          description: "Archived KK profiles with archive reasons and review notes.",
          href: "/api/admin/reports/export?type=archived_youth",
          reportKey: "archived_youth",
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
          href: "/api/admin/reports/export?type=active_scholars",
          reportKey: "active_scholars",
          icon: "badge-check",
          reportType: "STATIC",
        },
        {
          title: "Waitlisted Applicants",
          description: "Applicants ordered by their current waitlist position.",
          href: "/api/admin/reports/export?type=waitlisted_applicants",
          reportKey: "waitlisted_applicants",
          icon: "clock",
          reportType: "STATIC",
        },
        {
          title: "Pending Document Submissions",
          description: "Active scholars with missing COE or grade uploads for the current semester.",
          href: `/api/admin/reports/export?type=pending_documents&${pendingDocumentsParams.toString()}`,
          reportKey: "pending_documents",
          icon: "file-check",
          reportType: "PENDING_DOCUMENTS",
        },
        {
          title: "Non-Compliant Grantees Masterlist",
          description: "Active scholars who failed to submit mandatory semester requirements before the deadline.",
          href: "/api/admin/reports/export?type=non_compliant_grantees",
          reportKey: "non_compliant_grantees",
          icon: "file-check",
          reportType: "PENDING_DOCUMENTS",
        },
        {
          title: "Graduated Scholars Archive",
          description: "Graduated scholars with enrollment and end-date details.",
          href: "/api/admin/reports/export?type=graduated_scholars",
          reportKey: "graduated_scholars",
          icon: "history",
          reportType: "STATIC",
        },
        {
          title: "Revoked Grantees (with reasons)",
          description: "Revoked scholars with revocation dates and recorded reasons.",
          href: "/api/admin/reports/export?type=revoked_grantees",
          reportKey: "revoked_grantees",
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
          href: `/api/admin/reports/export?type=skeap_financial&${financialExportParams.toString()}`,
          reportKey: "skeap_financial",
          icon: "banknote",
          reportType: "SKEAP_FINANCIAL",
          semesterOptions,
        },
        {
          title: "Cash Disbursement Payout Receipts",
          description: "Current-semester payouts recorded as received/disbursed.",
          href: `/api/admin/reports/export?type=cash_disbursement_receipts&${receivedPayoutParams.toString()}`,
          reportKey: "cash_disbursement_receipts",
          icon: "file-check",
          reportType: "SKEAP_FINANCIAL",
          semesterOptions,
        },
        {
          title: "Unclaimed SKEAP Allowances",
          description: "Approved scholars who have not yet claimed their physical cash payout.",
          href: `/api/admin/reports/export?type=unclaimed_allowances&${unclaimedPayoutParams.toString()}`,
          reportKey: "unclaimed_allowances",
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
