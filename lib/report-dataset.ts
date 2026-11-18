import {
  AccountingPayoutStatus,
  GranteeStatus,
  Prisma,
  Role,
  SubmissionStatus,
} from "@prisma/client";
import { getAcademicTermScheduleState } from "@/lib/academic-term-schedule";
import { formatPayrollGranteeName } from "@/lib/accounting-payroll";
import { PICO_SITIOS } from "@/lib/barangay-sitios";
import { buildDemographicDistributionRows } from "@/lib/demographic-distribution";
import { formatDisplayName } from "@/lib/display-name";
import { getRetentionExpiryDate } from "@/lib/grantee-retention";
import { getKKMemberArchiveReasonLabel, isKKMemberAgeOutReason } from "@/lib/kk-member-archive";
import { getNonCompliantGrantees } from "@/lib/non-compliant-grantees";
import { getSkeapWaitlistSnapshot } from "@/lib/skeap-waitlist";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { hasGranteeRetentionColumn, prisma } from "@/lib/prisma";
import { parseReportDateRange } from "@/lib/report-export";

export const REPORT_KEYS = [
  "full_kk_census",
  "in_school_registry",
  "out_of_school_registry",
  "sk_registered_voters",
  "demographic_distribution",
  "archived_youth",
  "active_scholars",
  "waitlisted_applicants",
  "pending_documents",
  "non_compliant_grantees",
  "graduated_scholars",
  "revoked_grantees",
  "skeap_financial",
  "cash_disbursement_receipts",
  "unclaimed_allowances",
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];
export type ReportCell = string | number | boolean | Date | null;
export type ReportRow = Record<string, ReportCell>;
export type ReportColumn = {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
};
export type ReportSummaryMetric = {
  label: string;
  value: string | number;
};
export type ReportDataset = {
  title: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  summary: ReportSummaryMetric[];
  totalCount: number;
  grandTotalRow?: ReportRow;
  note?: string;
};

export class ReportDatasetError extends Error {}

const MEMBER_COLUMNS: ReportColumn[] = [
  { header: "Name", key: "fullName", width: 30 },
  { header: "Email", key: "email", width: 32 },
  { header: "Contact Number", key: "contactNumber", width: 20 },
  { header: "Age", key: "age", width: 10 },
  { header: "Age Group", key: "youthAgeGroup", width: 18 },
  { header: "Classification", key: "youthClassification", width: 24 },
  { header: "Work Status", key: "workStatus", width: 22 },
  { header: "SK Voter", key: "registeredSKVoter", width: 14 },
  { header: "Status", key: "reviewStatus", width: 14 },
  { header: "Submitted Date", key: "submittedAt", width: 20, numFmt: "mmm d, yyyy" },
];

const ARCHIVED_MEMBER_COLUMNS: ReportColumn[] = [
  { header: "Registration ID", key: "id", width: 38 },
  { header: "Program", key: "program", width: 14 },
  { header: "Full Name", key: "fullName", width: 30 },
  { header: "Middle Name", key: "middleName", width: 20 },
  { header: "Address", key: "address", width: 36 },
  { header: "Sex", key: "sex", width: 12 },
  { header: "Age", key: "age", width: 10 },
  { header: "Birth Date", key: "birthDate", width: 18, numFmt: "mmm d, yyyy" },
  { header: "Email", key: "email", width: 32 },
  { header: "Facebook", key: "facebook", width: 30 },
  { header: "Contact Number", key: "contactNumber", width: 20 },
  { header: "Civil Status", key: "civilStatus", width: 16 },
  { header: "Youth Classification", key: "youthClassification", width: 24 },
  { header: "Youth Age Group", key: "youthAgeGroup", width: 20 },
  { header: "Work Status", key: "workStatus", width: 20 },
  { header: "Educational Background", key: "educationalBackground", width: 28 },
  { header: "Registered SK Voter", key: "registeredSKVoter", width: 20 },
  { header: "Voted Last SK Election", key: "votedLastSK", width: 22 },
  { header: "Registered National Voter", key: "registeredNationalVoter", width: 25 },
  { header: "Attended KK Assembly", key: "attendedKKAssembly", width: 22 },
  { header: "Assembly Times", key: "assemblyTimes", width: 18 },
  { header: "No Assembly Reason", key: "noAssemblyReason", width: 30 },
  { header: "Consent", key: "consent", width: 12 },
  { header: "Residency Acknowledged", key: "residencyStatementAcknowledgement", width: 24 },
  { header: "Manual Review Required", key: "requiresManualReview", width: 24 },
  { header: "ID Document Type", key: "idDocumentType", width: 20 },
  { header: "ID Front File URL", key: "idFrontFileUrl", width: 48 },
  { header: "ID Back File URL", key: "idBackFileUrl", width: 48 },
  { header: "Single ID File URL", key: "idSingleFileUrl", width: 48 },
  { header: "Submitted Date", key: "submittedAt", width: 20, numFmt: "mmm d, yyyy" },
  { header: "Archived Date", key: "archivedAt", width: 20, numFmt: "mmm d, yyyy" },
  { header: "Review Status", key: "reviewStatus", width: 16 },
  { header: "Archive Reason", key: "archivedReason", width: 26 },
  { header: "Review Notes", key: "reviewNotes", width: 36 },
];

const ACTIVE_SCHOLAR_COLUMNS: ReportColumn[] = [
  { header: "Name", key: "fullName", width: 32 },
  { header: "Email", key: "email", width: 34 },
  { header: "Contact No", key: "contactNumber", width: 20 },
  { header: "School", key: "school", width: 36 },
  { header: "Year Level", key: "yearLevel", width: 22 },
  { header: "Status", key: "status", width: 16 },
  { header: "General Average", key: "generalAverage", width: 20 },
  { header: "Enrolled At", key: "dateEnrolled", width: 18, numFmt: "mmm d, yyyy" },
  { header: "Graduated At", key: "graduatedAt", width: 18, numFmt: "mmm d, yyyy" },
  { header: "Retention Expires At", key: "retentionExpiresAt", width: 22, numFmt: "mmm d, yyyy" },
];

const WAITLIST_COLUMNS: ReportColumn[] = [
  { header: "Waitlist Position", key: "waitlistPosition", width: 18 },
  { header: "Applicant Name", key: "applicantName", width: 32 },
  { header: "Email", key: "emailAddress", width: 34 },
  { header: "Contact Number", key: "contactNumber", width: 20 },
  { header: "School", key: "school", width: 36 },
  { header: "Education Level", key: "educationLevel", width: 22 },
  { header: "Course", key: "currentCourse", width: 28 },
  { header: "Year Level", key: "yearLevel", width: 18 },
  { header: "Submitted Date", key: "submittedAt", width: 20, numFmt: "mmm d, yyyy" },
];

const SUBMISSION_COLUMNS: ReportColumn[] = [
  { header: "Name", key: "name", width: 35 },
  { header: "Email", key: "email", width: 35 },
  { header: "School", key: "school", width: 40 },
  { header: "Year Level", key: "yearLevel", width: 25 },
  { header: "Semester", key: "semester", width: 30 },
  { header: "Status", key: "status", width: 25 },
];

const GRADUATED_COLUMNS: ReportColumn[] = [
  { header: "Name", key: "name", width: 32 },
  { header: "Status", key: "status", width: 16 },
  { header: "School", key: "school", width: 34 },
  { header: "Semester/Year", key: "yearLevel", width: 22 },
  { header: "Enrolled Date", key: "dateEnrolled", width: 18, numFmt: "mmm d, yyyy" },
  { header: "End Date", key: "endDate", width: 18, numFmt: "mmm d, yyyy" },
  { header: "Remarks", key: "remarks", width: 48 },
];

const REVOKED_COLUMNS: ReportColumn[] = [
  { header: "Name", key: "fullName", width: 32 },
  { header: "Email", key: "email", width: 34 },
  { header: "Sitio", key: "sitio", width: 20 },
  { header: "Date Revoked", key: "dateRevoked", width: 20, numFmt: "mmm d, yyyy" },
  { header: "Reason for Revocation", key: "reason", width: 48 },
];

const PAYROLL_COLUMNS: ReportColumn[] = [
  { header: "No.", key: "no", width: 8 },
  { header: "Name", key: "name", width: 30 },
  { header: "Position", key: "position", width: 18 },
  { header: "Incentives", key: "incentiveA", width: 16 },
  { header: "Incentives", key: "incentiveB", width: 16 },
  { header: "Incentives", key: "incentiveC", width: 16 },
  { header: "Total", key: "total", width: 16 },
  { header: "Net Amount Due", key: "netAmountDue", width: 20 },
  { header: "Signature of Recipient", key: "signature", width: 28 },
];

const TITLES: Record<ReportKey, string> = {
  full_kk_census: "Full KK Census Masterlist",
  in_school_registry: "In-School Youth Registry",
  out_of_school_registry: "Out-of-School Youth Registry",
  sk_registered_voters: "SK Registered Voters Masterlist",
  demographic_distribution: "Demographic Distribution (Gender & Sitio)",
  archived_youth: "Archived/Aged-Out Youth Records",
  active_scholars: "Active Scholars Masterlist",
  waitlisted_applicants: "Waitlisted Applicants",
  pending_documents: "Pending Document Submissions",
  non_compliant_grantees: "Non-Compliant Grantees Masterlist",
  graduated_scholars: "Graduated Scholars Archive",
  revoked_grantees: "Revoked Grantees (with reasons)",
  skeap_financial: "SKEAP Financial Masterlist (Current Semester)",
  cash_disbursement_receipts: "Cash Disbursement Payout Receipts",
  unclaimed_allowances: "Unclaimed SKEAP Allowances",
};

const ARCHIVED_AGE_OUT_REASONS = [
  "AGED_OUT",
  "Aged out (31+ years old - RA 10742)",
  "AGED_OUT_31",
  "Aged Out (31+)",
  "Aged Out (Turned 31)",
];

function summary(totalCount: number, ...metrics: ReportSummaryMetric[]): ReportSummaryMetric[] {
  return [{ label: "Total Records", value: totalCount }, ...metrics].slice(0, 3);
}

function dateRange(filters: Record<string, string>) {
  return parseReportDateRange(new URLSearchParams(filters));
}

function reportFilterReasonWhere(value: string): Prisma.ProfilingRegistrationWhereInput | null {
  switch (value) {
    case "aged_out":
      return { archivedReason: { in: ARCHIVED_AGE_OUT_REASONS } };
    case "transferred_residence":
      return { archivedReason: "Transferred Residence" };
    case "voluntary_withdrawal":
      return { archivedReason: "Voluntary Withdrawal / Opt-Out" };
    case "duplicate_or_invalid":
      return { archivedReason: { in: ["Duplicate or Invalid Record", "Duplicate Record"] } };
    case "deceased":
      return { archivedReason: "Deceased" };
    case "other":
      return { archivedReason: { startsWith: "Other:" } };
    default:
      return null;
  }
}

async function buildMemberDataset(reportKey: ReportKey, filters: Record<string, string>): Promise<ReportDataset> {
  const parsedRange = dateRange(filters);
  if (parsedRange.error) throw new ReportDatasetError(parsedRange.error);
  const filter = filters.filter ?? "all_approved";
  if (!["all_approved", "grantees_only", "kk_only"].includes(filter)) {
    throw new ReportDatasetError("Invalid member export filter.");
  }
  const classification = reportKey === "in_school_registry"
    ? "In school Youth"
    : reportKey === "out_of_school_registry"
      ? "Out of School Youth"
      : filters.classification;
  const validClassifications = [
    "In school Youth",
    "Out of School Youth",
    "Working Youth",
    "Person w/ Disability",
    "Indigenous People",
  ];
  if (classification && !validClassifications.includes(classification)) {
    throw new ReportDatasetError("Invalid member export classification.");
  }
  const skVoter = reportKey === "sk_registered_voters" ? "true" : filters.skVoter;
  if (skVoter && !["true", "false"].includes(skVoter)) {
    throw new ReportDatasetError("Invalid SK voter export filter.");
  }
  const granteeCondition = filter === "grantees_only"
    ? Prisma.sql`AND grantee."status" IN ('ACTIVE', 'PROBATIONARY')`
    : filter === "kk_only"
      ? Prisma.sql`AND (grantee."id" IS NULL OR grantee."status" NOT IN ('ACTIVE', 'PROBATIONARY'))`
      : Prisma.empty;
  const classificationCondition = classification
    ? Prisma.sql`AND LOWER(BTRIM(registration."youthClassification")) = LOWER(BTRIM(${classification}))`
    : Prisma.empty;
  const skVoterCondition = skVoter === "true"
    ? Prisma.sql`AND LOWER(BTRIM(registration."registeredSKVoter")) IN ('yes', 'true')`
    : skVoter === "false"
      ? Prisma.sql`AND LOWER(BTRIM(registration."registeredSKVoter")) NOT IN ('yes', 'true')`
      : Prisma.empty;
  const submittedRange = Prisma.sql`
    ${parsedRange.startDate ? Prisma.sql`AND registration."submittedAt" >= ${parsedRange.startDate}` : Prisma.empty}
    ${parsedRange.endDateExclusive ? Prisma.sql`AND registration."submittedAt" < ${parsedRange.endDateExclusive}` : Prisma.empty}
  `;
  const rows = await prisma.$queryRaw<Array<{
    fullName: string;
    email: string;
    contactNumber: string;
    age: number;
    youthAgeGroup: string;
    youthClassification: string;
    workStatus: string;
    registeredSKVoter: string;
    reviewStatus: string;
    submittedAt: Date;
    sex: string;
  }>>(Prisma.sql`
    SELECT
      registration."fullName",
      registration."email",
      registration."contactNumber",
      registration."age",
      registration."youthAgeGroup",
      registration."youthClassification",
      registration."workStatus",
      registration."registeredSKVoter",
      registration."reviewStatus",
      registration."submittedAt",
      registration."sex"
    FROM "public"."kk_profiling_registrations" AS registration
    LEFT JOIN "public"."users" AS account ON account."id" = registration."userId"
    LEFT JOIN "public"."grantees" AS grantee ON grantee."userId" = account."id"
    WHERE registration."reviewStatus" = 'Approved'
    ${granteeCondition}
    ${classificationCondition}
    ${skVoterCondition}
    ${submittedRange}
    ORDER BY registration."submittedAt" DESC
  `);
  const classificationMetric = reportKey === "in_school_registry"
    ? { label: "In-School Youth", value: rows.length }
    : reportKey === "out_of_school_registry"
      ? { label: "Out-of-School Youth", value: rows.length }
      : reportKey === "sk_registered_voters"
        ? { label: "Registered SK Voters", value: rows.length }
        : {
            label: "In-School Youth",
            value: rows.filter((row) => row.youthClassification.toLowerCase().includes("in school")).length,
          };
  const summaryMetrics = [
    classificationMetric,
    {
      label: "Male / Female",
      value: `${rows.filter((row) => row.sex.trim().toLowerCase() === "male").length} / ${rows.filter((row) => row.sex.trim().toLowerCase() === "female").length}`,
    },
  ];
  return {
    title: TITLES[reportKey],
    columns: MEMBER_COLUMNS,
    rows,
    summary: summary(rows.length, ...summaryMetrics),
    totalCount: rows.length,
  };
}

async function buildArchivedDataset(filters: Record<string, string>): Promise<ReportDataset> {
  const parsedRange = dateRange(filters);
  if (parsedRange.error) throw new ReportDatasetError(parsedRange.error);
  const reasonFilter = filters.archiveReason ?? "all";
  const reasonWhere = reasonFilter === "all" ? null : reportFilterReasonWhere(reasonFilter);
  if (reasonFilter !== "all" && !reasonWhere) throw new ReportDatasetError("Invalid archive reason filter.");
  const records = await prisma.profilingRegistration.findMany({
    where: {
      reviewStatus: "Archived",
      ...(parsedRange.startDate || parsedRange.endDateExclusive
        ? {
            archivedAt: {
              not: null,
              ...(parsedRange.startDate ? { gte: parsedRange.startDate } : {}),
              ...(parsedRange.endDateExclusive ? { lt: parsedRange.endDateExclusive } : {}),
            },
          }
        : {}),
      ...(reasonWhere ?? {}),
    },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      program: true,
      fullName: true,
      middleName: true,
      address: true,
      sex: true,
      age: true,
      birthDate: true,
      email: true,
      facebook: true,
      contactNumber: true,
      civilStatus: true,
      youthClassification: true,
      youthAgeGroup: true,
      workStatus: true,
      educationalBackground: true,
      registeredSKVoter: true,
      votedLastSK: true,
      registeredNationalVoter: true,
      attendedKKAssembly: true,
      assemblyTimes: true,
      noAssemblyReason: true,
      consent: true,
      residencyStatementAcknowledgement: true,
      requiresManualReview: true,
      idDocumentType: true,
      idFrontFileUrl: true,
      idBackFileUrl: true,
      idSingleFileUrl: true,
      submittedAt: true,
      archivedAt: true,
      reviewStatus: true,
      archivedReason: true,
      reviewNotes: true,
    },
  });
  const rows = records.map((record) => ({
    ...record,
    archivedReason: getKKMemberArchiveReasonLabel(record.archivedReason),
  }));
  const agedOutCount = records.filter((record) => isKKMemberAgeOutReason(record.archivedReason)).length;
  const deceasedCount = records.filter((record) => record.archivedReason?.trim().toLowerCase() === "deceased").length;
  return {
    title: TITLES.archived_youth,
    columns: ARCHIVED_MEMBER_COLUMNS,
    rows,
    summary: summary(records.length, { label: "Aged Out (31+)", value: agedOutCount }, { label: "Deceased", value: deceasedCount }),
    totalCount: records.length,
  };
}

async function buildDemographicDataset(): Promise<ReportDataset> {
  const groups = await prisma.$queryRaw<Array<{ purok: string; sex: string; count: number }>>`
    SELECT profile."purok" AS "purok", profile."sex"::text AS "sex", COUNT(*)::int AS "count"
    FROM public."kk_profiles" AS profile
    WHERE profile."isVerified" = TRUE
    GROUP BY profile."purok", profile."sex"
  `;
  const rows = buildDemographicDistributionRows(groups, PICO_SITIOS).map((row) => ({
    sitio: row.sitio,
    male: row.male,
    female: row.female,
    total: row.total,
  }));
  const grandTotalRow: ReportRow = {
    sitio: "Grand Total",
    male: rows.reduce((total, row) => total + Number(row.male), 0),
    female: rows.reduce((total, row) => total + Number(row.female), 0),
    total: rows.reduce((total, row) => total + Number(row.total), 0),
  };
  const notSpecifiedCount = groups
    .filter((group) => group.sex === "NOT_SPECIFIED")
    .reduce((total, group) => total + group.count, 0);
  return {
    title: TITLES.demographic_distribution,
    columns: [
      { header: "Sitio Name", key: "sitio", width: 30 },
      { header: "Total Male Youth", key: "male", width: 20 },
      { header: "Total Female Youth", key: "female", width: 22 },
      { header: "Total Youth", key: "total", width: 17 },
    ],
    rows,
    summary: [
      { label: "Total Youth", value: Number(grandTotalRow.total) },
      { label: "Male / Female", value: `${grandTotalRow.male} / ${grandTotalRow.female}` },
      { label: "Unspecified Sex", value: notSpecifiedCount },
    ],
    totalCount: Number(grandTotalRow.total),
    grandTotalRow,
    note: "Total Youth includes verified profiles with unspecified sex; male and female columns show recorded categories only.",
  };
}

async function buildActiveScholarsDataset(filters: Record<string, string>): Promise<ReportDataset> {
  const parsedRange = dateRange(filters);
  if (parsedRange.error) throw new ReportDatasetError(parsedRange.error);
  const query = filters.q?.trim() ?? "";
  const restoredAfterRemovalSql = `EXISTS (
    SELECT 1 FROM "audit_logs" role_change
    WHERE role_change."targetTable" = 'users'
      AND role_change."targetId" = profile_user."id"
      AND role_change."action" = 'UPDATE_USER_ROLE'
      AND role_change."afterData"->>'role' = 'GRANTEE'
      AND role_change."createdAt" >= g."updatedAt"
      AND NOT EXISTS (
        SELECT 1 FROM "audit_logs" newer_role_change
        WHERE newer_role_change."targetTable" = 'users'
          AND newer_role_change."targetId" = profile_user."id"
          AND newer_role_change."action" = 'UPDATE_USER_ROLE'
          AND newer_role_change."createdAt" > role_change."createdAt"
      )
  )`;
  const profileStatusSql = `AND profile_user."role"::text = 'GRANTEE' AND (
    g."status"::text IN ('ACTIVE', 'PROBATIONARY')
    OR (g."status"::text = 'REMOVED' AND ${restoredAfterRemovalSql})
  )`;
  const hasRetentionColumn = await hasGranteeRetentionColumn();
  const pageKeys = await prisma.$queryRawUnsafe<Array<{
    source: "profile" | "fallback";
    recordId: string;
    userId: string;
  }>>(
    `SELECT 'profile'::text AS "source", g."id"::text AS "recordId", g."userId"::text AS "userId", g."updatedAt" AS "updatedAt"
     FROM "grantees" g
     JOIN "users" profile_user ON profile_user."id" = g."userId"
     LEFT JOIN "kk_profiles" kk_profile ON kk_profile."id" = profile_user."kkProfileId"
     WHERE TRUE ${profileStatusSql}
       AND ($2::timestamp IS NULL OR g."dateEnrolled" >= $2::timestamp)
       AND ($3::timestamp IS NULL OR g."dateEnrolled" < $3::timestamp)
       AND ($1 = '' OR concat_ws(' ', profile_user."fullName", profile_user."email", profile_user."phoneNumber",
         kk_profile."fullName", kk_profile."firstName", kk_profile."middleName", kk_profile."lastName",
         kk_profile."contactNumber", g."school", g."yearLevel") ILIKE '%' || $1 || '%'
         OR EXISTS (SELECT 1 FROM "skeap_applications" search_application
           WHERE search_application."userId" = profile_user."id"
             AND search_application."contactNumber" ILIKE '%' || $1 || '%'))
     UNION ALL
     SELECT 'fallback'::text AS "source", ('user-' || u."id")::text AS "recordId", u."id"::text AS "userId", u."updatedAt" AS "updatedAt"
     FROM "users" u
     LEFT JOIN "kk_profiles" kk_profile ON kk_profile."id" = u."kkProfileId"
     WHERE u."role"::text = 'GRANTEE'
       AND NOT EXISTS (SELECT 1 FROM "grantees" g WHERE g."userId" = u."id")
       AND ($2::timestamp IS NULL OR u."createdAt" >= $2::timestamp)
       AND ($3::timestamp IS NULL OR u."createdAt" < $3::timestamp)
       AND ($1 = '' OR concat_ws(' ', u."fullName", u."email", u."phoneNumber", kk_profile."fullName",
         kk_profile."firstName", kk_profile."middleName", kk_profile."lastName", kk_profile."contactNumber")
         ILIKE '%' || $1 || '%'
         OR EXISTS (SELECT 1 FROM "skeap_applications" search_application
           WHERE search_application."userId" = u."id"
             AND search_application."contactNumber" ILIKE '%' || $1 || '%'))
     ORDER BY "updatedAt" DESC, "recordId" ASC`,
    query,
    parsedRange.startDate,
    parsedRange.endDateExclusive,
  );
  const profileIds = pageKeys.filter((item) => item.source === "profile").map((item) => item.recordId);
  const fallbackIds = pageKeys.filter((item) => item.source === "fallback").map((item) => item.userId);
  const [grantees, fallbackUsers] = await Promise.all([
    prisma.grantee.findMany({
      where: { id: { in: profileIds } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        school: true,
        yearLevel: true,
        generalAverage: true,
        dateEnrolled: true,
        graduatedAt: true,
        ...(hasRetentionColumn ? { retentionExpiresAt: true } : {}),
        user: { select: { fullName: true, email: true, phoneNumber: true, role: true } },
      },
    }),
    prisma.user.findMany({
      where: { id: { in: fallbackIds } },
      select: { id: true, fullName: true, email: true, phoneNumber: true, createdAt: true },
    }),
  ]);
  const profileRows = grantees.map((grantee) => ({
    fullName: grantee.user.fullName,
    email: grantee.user.email,
    contactNumber: grantee.user.phoneNumber || "—",
    school: normalizeSkeapSchoolName(grantee.school),
    yearLevel: grantee.yearLevel,
    status:
      grantee.status === "ACTIVE" ||
      grantee.status === "PROBATIONARY" ||
      (grantee.status === "REMOVED" && grantee.user.role === "GRANTEE")
        ? "Active"
        : grantee.status,
    generalAverage: grantee.generalAverage ?? "—",
    dateEnrolled: grantee.dateEnrolled,
    graduatedAt: grantee.graduatedAt ?? "—",
    retentionExpiresAt: getRetentionExpiryDate(grantee) ?? "—",
  }));
  const fallbackRows = fallbackUsers.map((user) => ({
    fullName: user.fullName,
    email: user.email,
    contactNumber: user.phoneNumber || "—",
    school: "No school provided",
    yearLevel: "No year level provided",
    status: "Active",
    generalAverage: "—",
    dateEnrolled: user.createdAt,
    graduatedAt: "—",
    retentionExpiresAt: "—",
  }));
  const profilesById = new Map(grantees.map((grantee, index) => [grantee.id, profileRows[index]]));
  const fallbacksById = new Map(fallbackUsers.map((user, index) => [`user-${user.id}`, fallbackRows[index]]));
  const rows = pageKeys.flatMap((item) => {
    const row = item.source === "profile"
      ? profilesById.get(item.recordId)
      : fallbacksById.get(item.recordId);
    return row ? [row] : [];
  });
  return {
    title: TITLES.active_scholars,
    columns: ACTIVE_SCHOLAR_COLUMNS,
    rows,
    summary: summary(rows.length, {
      label: "Active / Probationary",
      value: `${rows.filter((row) => row.status === "Active").length} / ${rows.filter((row) => row.status === "PROBATIONARY").length}`,
    }),
    totalCount: rows.length,
  };
}

async function buildWaitlistDataset(filters: Record<string, string>): Promise<ReportDataset> {
  const parsedRange = dateRange(filters);
  if (parsedRange.error) throw new ReportDatasetError(parsedRange.error);
  const snapshot = await getSkeapWaitlistSnapshot();
  const rows = snapshot.applications
    .filter((application) => {
      const submittedAt = new Date(application.submittedAt);
      return (!parsedRange.startDate || submittedAt >= parsedRange.startDate)
        && (!parsedRange.endDateExclusive || submittedAt < parsedRange.endDateExclusive);
    })
    .map((application) => ({
      ...application,
      submittedAt: new Date(application.submittedAt),
    }));
  return {
    title: TITLES.waitlisted_applicants,
    columns: WAITLIST_COLUMNS,
    rows,
    summary: summary(rows.length, { label: "Open Slots", value: snapshot.openSlotCount }, { label: "Offers", value: snapshot.offeredCount }),
    totalCount: rows.length,
  };
}

async function buildSubmissionsDataset(
  reportKey: "pending_documents" | "non_compliant_grantees",
  filters: Record<string, string>,
): Promise<ReportDataset> {
  const search = filters.search?.trim() ?? "";
  const requestedSemester = filters.semester?.trim() ?? "";
  const missingDocument = filters.missingDocument ?? "all";
  if (!["all", "grades", "coe"].includes(missingDocument)) {
    throw new ReportDatasetError("Invalid missing document type filter.");
  }
  let semester = requestedSemester && requestedSemester !== "all" ? requestedSemester : "";
  let rows: ReportRow[] = [];

  if (reportKey === "non_compliant_grantees") {
    const schedule = await getAcademicTermScheduleState();
    const activeSemester = semester || schedule.window.semester;
    if (!activeSemester) throw new ReportDatasetError("No active semester is configured for this report.");
    semester = activeSemester;
    const { records } = await getNonCompliantGrantees(activeSemester, { search });
    const selectedMissingDocument = missingDocument as "all" | "grades" | "coe";
    rows = records
      .filter((grantee) => selectedMissingDocument === "all"
        || grantee.missingDocuments.includes(selectedMissingDocument)
        || grantee.rejectedDocuments.includes(selectedMissingDocument))
      .map((grantee) => ({
        name: grantee.fullName,
        email: grantee.email || "N/A",
        school: grantee.school,
        yearLevel: grantee.yearLevel,
        semester,
        status: `${grantee.statusLabel}: ${grantee.issues.join(", ")}`,
      }));
  } else {
    const schedule = await getAcademicTermScheduleState();
    semester = semester || schedule.window.semester || "";
    const semesterFilter = semester
      ? { semester: { equals: semester, mode: "insensitive" as const } }
      : undefined;
    const missingConditions: Prisma.SubmissionWhereInput[] = [];
    if (missingDocument === "all" || missingDocument === "coe") missingConditions.push({ coeFileUrl: "" });
    if (missingDocument === "all" || missingDocument === "grades") missingConditions.push({ gradeFileUrl: "" });
    const missingSubmissionFilter: Prisma.GranteeWhereInput = semesterFilter
      ? {
          OR: [
            { submissions: { none: semesterFilter } },
            { submissions: { some: { ...semesterFilter, OR: missingConditions } } },
          ],
        }
      : {
          OR: [
            { submissions: { none: {} } },
            { submissions: { some: { OR: missingConditions } } },
          ],
        };
    const searchFilters: Prisma.GranteeWhereInput = {
      OR: [
        { user: { is: { fullName: { contains: search, mode: Prisma.QueryMode.insensitive } } } },
        { user: { is: { email: { contains: search, mode: Prisma.QueryMode.insensitive } } } },
        { school: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { yearLevel: { contains: search, mode: Prisma.QueryMode.insensitive } },
      ],
    };
    const grantees = await prisma.grantee.findMany({
      where: {
        status: "ACTIVE",
        AND: [missingSubmissionFilter, ...(search ? [searchFilters] : [])],
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        school: true,
        yearLevel: true,
        user: { select: { fullName: true, email: true } },
        submissions: {
          where: { ...(semesterFilter ?? {}), OR: missingConditions },
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: { semester: true, coeFileUrl: true, gradeFileUrl: true },
        },
      },
    });
    rows = grantees.map((grantee) => {
      const submission = grantee.submissions[0];
      const missing = [
        (missingDocument === "all" || missingDocument === "coe") && !submission?.coeFileUrl
          ? "Certificate of Enrollment"
          : null,
        (missingDocument === "all" || missingDocument === "grades") && !submission?.gradeFileUrl
          ? "Grade Report"
          : null,
      ].filter((value): value is string => value !== null);
      return {
        name: grantee.user.fullName,
        email: grantee.user.email || "N/A",
        school: grantee.school,
        yearLevel: grantee.yearLevel,
        semester: submission?.semester ?? semester ?? "All Semesters",
        status: submission ? `Incomplete: ${missing.join(", ")}` : "Missing Submission",
      };
    });
  }

  return {
    title: TITLES[reportKey],
    columns: SUBMISSION_COLUMNS,
    rows,
    summary: summary(
      rows.length,
      {
        label: "Fully Cleared",
        value: rows.filter((row) => String(row.status).includes("Fully Cleared")).length,
      },
    ),
    totalCount: rows.length,
  };
}

async function buildGraduatedDataset(filters: Record<string, string>): Promise<ReportDataset> {
  const parsedRange = dateRange(filters);
  if (parsedRange.error) throw new ReportDatasetError(parsedRange.error);
  const records = await prisma.$queryRaw<Array<{
    name: string | null;
    school: string;
    yearLevel: string;
    dateEnrolled: Date;
    endDate: Date | null;
    remarks: string | null;
  }>>(Prisma.sql`
    SELECT account."fullName" AS "name", grantee."school", grantee."yearLevel",
      grantee."dateEnrolled", grantee."graduatedAt" AS "endDate", grantee."remarks"
    FROM "public"."grantees" AS grantee
    INNER JOIN "public"."users" AS account ON account."id" = grantee."userId"
    WHERE grantee."status"::text = ${GranteeStatus.GRADUATED}
    ${parsedRange.startDate ? Prisma.sql`AND grantee."graduatedAt" >= ${parsedRange.startDate}` : Prisma.empty}
    ${parsedRange.endDateExclusive ? Prisma.sql`AND grantee."graduatedAt" < ${parsedRange.endDateExclusive}` : Prisma.empty}
    ORDER BY grantee."graduatedAt" DESC NULLS LAST, grantee."updatedAt" DESC
  `);
  const rows = records.map((record) => ({
    name: record.name ?? "Unknown scholar",
    status: "Graduated",
    school: record.school,
    yearLevel: record.yearLevel,
    dateEnrolled: record.dateEnrolled,
    endDate: record.endDate,
    remarks: record.remarks ?? "",
  }));
  return {
    title: TITLES.graduated_scholars,
    columns: GRADUATED_COLUMNS,
    rows,
    summary: summary(rows.length, { label: "Graduated", value: rows.length }),
    totalCount: rows.length,
  };
}

async function buildRevokedDataset(filters: Record<string, string>): Promise<ReportDataset> {
  const parsedRange = dateRange(filters);
  if (parsedRange.error) throw new ReportDatasetError(parsedRange.error);
  const reasonFilter = filters.reason ?? "all";
  const reasonFilters: Record<string, string> = {
    failing_grades: "fail",
    misconduct: "misconduct",
    moved_out_of_barangay: "moved out of barangay",
  };
  const reasonSearch = reasonFilter === "all" ? undefined : reasonFilters[reasonFilter];
  if (reasonFilter !== "all" && !reasonSearch) throw new ReportDatasetError("Invalid revocation reason filter.");
  const grantees = await prisma.grantee.findMany({
    where: {
      status: { in: [GranteeStatus.REMOVED, GranteeStatus.REVOKED] },
      dateRemoved: {
        not: null,
        ...(parsedRange.startDate ? { gte: parsedRange.startDate } : {}),
        ...(parsedRange.endDateExclusive ? { lt: parsedRange.endDateExclusive } : {}),
      },
      ...(reasonSearch
        ? {
            OR: [
              { revocationReason: { contains: reasonSearch, mode: "insensitive" as const } },
              { revocationNotes: { contains: reasonSearch, mode: "insensitive" as const } },
              { remarks: { contains: reasonSearch, mode: "insensitive" as const } },
              { submissions: { some: { status: SubmissionStatus.REMOVED, reviewNotes: { contains: reasonSearch, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    },
    orderBy: [{ dateRemoved: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      dateRemoved: true,
      revocationReason: true,
      revocationNotes: true,
      remarks: true,
      user: {
        select: {
          fullName: true,
          email: true,
          kkProfile: { select: { firstName: true, middleName: true, lastName: true, purok: true } },
        },
      },
      submissions: {
        where: { status: SubmissionStatus.REMOVED },
        orderBy: { reviewedAt: "desc" },
        take: 1,
        select: { reviewNotes: true },
      },
    },
  });
  const rows = grantees.flatMap((grantee) => grantee.dateRemoved
    ? [{
        fullName: formatDisplayName(grantee.user.kkProfile, grantee.user.fullName),
        email: grantee.user.email,
        sitio: grantee.user.kkProfile?.purok ?? "",
        dateRevoked: grantee.dateRemoved,
        reason: grantee.revocationReason?.trim()
          ? [
              grantee.revocationReason.trim(),
              grantee.revocationNotes?.trim() ? `Additional Notes: ${grantee.revocationNotes.trim()}` : null,
            ].filter(Boolean).join("\n")
          : grantee.remarks?.trim() || grantee.submissions[0]?.reviewNotes?.trim() || "No reason recorded",
      }]
    : []);
  return {
    title: TITLES.revoked_grantees,
    columns: REVOKED_COLUMNS,
    rows,
    summary: summary(rows.length, { label: "Date Range", value: parsedRange.startDate || parsedRange.endDateExclusive ? "Filtered" : "All Dates" }),
    totalCount: rows.length,
  };
}

async function buildFinancialDataset(
  reportKey: "skeap_financial" | "cash_disbursement_receipts" | "unclaimed_allowances",
  filters: Record<string, string>,
): Promise<ReportDataset> {
  const parsedRange = dateRange(filters);
  if (parsedRange.error) throw new ReportDatasetError(parsedRange.error);
  const semesterId = filters.semesterId?.trim();
  const semesterName = filters.semester?.trim();
  if (!semesterId && !semesterName) throw new ReportDatasetError("A semester is required.");
  const semesterRecord = semesterId
    ? await prisma.semester.findUnique({ where: { id: semesterId }, select: { name: true } })
    : null;
  const semester = (semesterRecord?.name ?? semesterName ?? semesterId ?? "")
    .replace(/\s*\(Current\)$/i, "")
    .trim();
  if (!semester) throw new ReportDatasetError("A valid semester is required.");
  const reportType = reportKey === "cash_disbursement_receipts"
    ? "received_payouts"
    : reportKey === "unclaimed_allowances"
      ? "unclaimed_payouts"
      : "master_payroll";
  const selectedSemesterFilter = { semester: { equals: semester, mode: "insensitive" as const } };
  const where: Prisma.GranteeWhereInput = {
    status: { in: [GranteeStatus.ACTIVE, GranteeStatus.PROBATIONARY] },
    user: { is: { isActive: true, role: Role.GRANTEE } },
    ...(reportType !== "received_payouts" && (parsedRange.startDate || parsedRange.endDateExclusive)
      ? {
          dateEnrolled: {
            ...(parsedRange.startDate ? { gte: parsedRange.startDate } : {}),
            ...(parsedRange.endDateExclusive ? { lt: parsedRange.endDateExclusive } : {}),
          },
        }
      : {}),
  };
  const payoutStatus = reportType === "received_payouts"
    ? "received"
    : reportType === "unclaimed_payouts"
      ? "unclaimed"
      : undefined;
  if (payoutStatus === "unclaimed") {
    where.payout = {
      is: {
        status: AccountingPayoutStatus.DISBURSED_UNCONFIRMED,
        semester,
        disbursedAt: { not: null },
        claimedAt: null,
      },
    };
  } else if (payoutStatus === "received") {
    where.payout = {
      is: {
        disbursedAt: {
          not: null,
          ...(parsedRange.startDate ? { gte: parsedRange.startDate } : {}),
          ...(parsedRange.endDateExclusive ? { lt: parsedRange.endDateExclusive } : {}),
        },
      },
    };
  }
  const grantees = await prisma.grantee.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      user: {
        select: {
          fullName: true,
          kkProfile: { select: { lastName: true, firstName: true, middleName: true } },
        },
      },
      submissions: {
        where: selectedSemesterFilter,
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { semester: true, status: true },
      },
      payout: { select: { status: true, disbursedAt: true, claimedAt: true } },
    },
  });
  const rows = grantees.map((grantee, index) => ({
    no: index + 1,
    name: formatPayrollGranteeName(grantee.user.kkProfile, grantee.user.fullName),
    position: "Scholar",
    incentiveA: 5000,
    incentiveB: null,
    incentiveC: null,
    total: 5000,
    netAmountDue: 5000,
    signature: null,
  }));
  return {
    title: TITLES[reportKey],
    columns: PAYROLL_COLUMNS,
    rows,
    summary: summary(
      rows.length,
      {
        label: reportKey === "skeap_financial" ? "Total Payroll Amount" : "Total Disbursed Amount",
        value: rows.length * 5000,
      },
      { label: "Semester", value: semester },
    ),
    totalCount: rows.length,
    grandTotalRow: {
      no: null,
      name: "TOTAL",
      position: null,
      incentiveA: null,
      incentiveB: null,
      incentiveC: null,
      total: rows.length * 5000,
      netAmountDue: rows.length * 5000,
      signature: null,
    },
  };
}

export async function buildReportDataset(
  reportKey: ReportKey,
  filters: Record<string, string>,
): Promise<ReportDataset> {
  if (
    reportKey === "full_kk_census" ||
    reportKey === "in_school_registry" ||
    reportKey === "out_of_school_registry" ||
    reportKey === "sk_registered_voters"
  ) {
    return buildMemberDataset(reportKey, filters);
  }
  if (reportKey === "archived_youth") return buildArchivedDataset(filters);
  if (reportKey === "demographic_distribution") return buildDemographicDataset();
  if (reportKey === "active_scholars") return buildActiveScholarsDataset(filters);
  if (reportKey === "waitlisted_applicants") return buildWaitlistDataset(filters);
  if (reportKey === "pending_documents" || reportKey === "non_compliant_grantees") {
    return buildSubmissionsDataset(reportKey, filters);
  }
  if (reportKey === "graduated_scholars") return buildGraduatedDataset(filters);
  if (reportKey === "revoked_grantees") return buildRevokedDataset(filters);
  return buildFinancialDataset(reportKey, filters);
}

export function isReportKey(value: string): value is ReportKey {
  return REPORT_KEYS.some((reportKey) => reportKey === value);
}
