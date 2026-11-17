import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import {
  BackupStatus,
  BackupTrigger,
  MessageTemplateChannel,
  MessageTemplateType,
  Prisma,
  ReminderType,
  Role,
  type Prisma as PrismaTypes,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import {
  refreshKkProfilingApplicationsAdminView,
  refreshSkeapApplicationsAdminView,
} from "@/lib/application-admin-view-refresh";
import { persistScheduledBackup } from "@/lib/data-backup-storage";

const APP_NAME = "SKonnect";
const BARANGAY_NAME = "Barangay Pico, La Trinidad, Benguet";
const BACKUP_VERSION = "1.0";
const BACKUP_TABLES = [
  "kkProfiles",
  "users",
  "profilingRegistrations",
  "skeapApplications",
  "grantees",
  "submissions",
  "accountingPayouts",
  "inquiries",
  "announcements",
  "notifications",
  "notificationLogs",
  "adminNotifications",
  "granteeMessages",
  "registrations",
  "systemSettings",
  "adminSettings",
  "academicTermSchedules",
  "semesters",
  "reminderSettings",
  "messageTemplates",
] as const;

const USER_BACKUP_SELECT = {
  id: true,
  authId: true,
  email: true,
  fullName: true,
  phoneNumber: true,
  role: true,
  kkStatus: true,
  languagePref: true,
  barangay: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  settings: true,
  avatarUrl: true,
  hasSeenOnboarding: true,
  username: true,
  kkProfileId: true,
  emailNotifications: true,
} satisfies PrismaTypes.UserSelect;

export type BackupTable = (typeof BACKUP_TABLES)[number];
export type BackupTriggerInput = "MANUAL" | "SCHEDULED";
export type BackupCounts = Record<BackupTable, number>;

type BackupRow = Record<string, unknown>;
type BackupData = Record<BackupTable, BackupRow[]>;

export type BackupSnapshot = {
  meta: {
    app: string;
    barangay: string;
    version: string;
    createdAt: string;
    trigger: BackupTriggerInput;
    recordCounts: BackupCounts;
  };
  data: BackupData;
  checksumSha256: string;
};

export class BackupSnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupSnapshotValidationError";
  }
}

export class BackupRestoreCommittedError extends Error {
  constructor() {
    super("Backup data was restored, but refreshing the admin application views failed.");
    this.name = "BackupRestoreCommittedError";
  }
}

function createFileName(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `skonnect-backup-${values.year}-${values.month}-${values.day}-${values.hour}${values.minute}.json`;
}

function checksumFor(meta: BackupSnapshot["meta"], data: BackupData) {
  return createHash("sha256").update(JSON.stringify({ meta, data })).digest("hex");
}

async function readAllBackupData(): Promise<BackupData> {
  const [
    kkProfiles,
    users,
    profilingRegistrations,
    skeapApplications,
    grantees,
    submissions,
    accountingPayouts,
    inquiries,
    announcements,
    notifications,
    notificationLogs,
    adminNotifications,
    granteeMessages,
    registrations,
    systemSettings,
    adminSettings,
    academicTermSchedules,
    semesters,
    reminderSettings,
    messageTemplates,
  ] = await Promise.all([
    prisma.kKProfile.findMany(),
    prisma.user.findMany({ select: USER_BACKUP_SELECT }),
    prisma.profilingRegistration.findMany(),
    prisma.skeapApplication.findMany(),
    prisma.grantee.findMany(),
    prisma.submission.findMany(),
    prisma.accountingPayout.findMany(),
    prisma.inquiry.findMany(),
    prisma.announcement.findMany(),
    prisma.notification.findMany(),
    prisma.notificationLog.findMany(),
    prisma.adminNotification.findMany(),
    prisma.granteeMessage.findMany(),
    prisma.registrations.findMany(),
    prisma.systemSetting.findMany(),
    prisma.adminSettings.findMany(),
    prisma.academicTermSchedule.findMany(),
    prisma.semester.findMany(),
    prisma.reminderSetting.findMany(),
    prisma.messageTemplate.findMany(),
  ]);

  return {
    kkProfiles,
    users,
    profilingRegistrations,
    skeapApplications,
    grantees,
    submissions,
    accountingPayouts,
    inquiries,
    announcements,
    notifications,
    notificationLogs,
    adminNotifications,
    granteeMessages,
    registrations,
    systemSettings,
    adminSettings,
    academicTermSchedules,
    semesters,
    reminderSettings,
    messageTemplates,
  };
}

function countRecords(data: BackupData): BackupCounts {
  return Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, data[table].length]),
  ) as BackupCounts;
}

export async function getLiveBackupRecordCounts(): Promise<BackupCounts> {
  const [
    kkProfiles,
    users,
    profilingRegistrations,
    skeapApplications,
    grantees,
    submissions,
    accountingPayouts,
    inquiries,
    announcements,
    notifications,
    notificationLogs,
    adminNotifications,
    granteeMessages,
    registrations,
    systemSettings,
    adminSettings,
    academicTermSchedules,
    semesters,
    reminderSettings,
    messageTemplates,
  ] = await Promise.all([
    prisma.kKProfile.count(),
    prisma.user.count(),
    prisma.profilingRegistration.count(),
    prisma.skeapApplication.count(),
    prisma.grantee.count(),
    prisma.submission.count(),
    prisma.accountingPayout.count(),
    prisma.inquiry.count(),
    prisma.announcement.count(),
    prisma.notification.count(),
    prisma.notificationLog.count(),
    prisma.adminNotification.count(),
    prisma.granteeMessage.count(),
    prisma.registrations.count(),
    prisma.systemSetting.count(),
    prisma.adminSettings.count(),
    prisma.academicTermSchedule.count(),
    prisma.semester.count(),
    prisma.reminderSetting.count(),
    prisma.messageTemplate.count(),
  ]);

  return {
    kkProfiles,
    users,
    profilingRegistrations,
    skeapApplications,
    grantees,
    submissions,
    accountingPayouts,
    inquiries,
    announcements,
    notifications,
    notificationLogs,
    adminNotifications,
    granteeMessages,
    registrations,
    systemSettings,
    adminSettings,
    academicTermSchedules,
    semesters,
    reminderSettings,
    messageTemplates,
  };
}

export async function generateSystemBackupSnapshot({
  actorId,
  trigger,
}: {
  actorId: string | null;
  trigger: BackupTriggerInput;
}) {
  const createdAt = new Date();
  const fileName = createFileName(createdAt);
  let recordCounts: Record<string, number> = {};
  let fileSizeBytes = 0;
  let checksumSha256 = "";

  try {
    const data = await readAllBackupData();
    const counts = countRecords(data);
    recordCounts = counts;
    const meta: BackupSnapshot["meta"] = {
      app: APP_NAME,
      barangay: BARANGAY_NAME,
      version: BACKUP_VERSION,
      createdAt: createdAt.toISOString(),
      trigger,
      recordCounts: counts,
    };
    checksumSha256 = checksumFor(meta, data);
    const snapshot: BackupSnapshot = { meta, data, checksumSha256 };
    const jsonString = JSON.stringify(snapshot, null, 2);
    fileSizeBytes = Buffer.byteLength(jsonString, "utf8");
    if (trigger === "SCHEDULED") {
      await persistScheduledBackup(fileName, jsonString);
    }

    const log = await prisma.backupLog.create({
      data: {
        fileName,
        trigger: trigger === "MANUAL" ? BackupTrigger.MANUAL : BackupTrigger.SCHEDULED,
        status: BackupStatus.COMPLETED,
        recordCounts,
        fileSizeBytes,
        checksumSha256,
        createdById: actorId,
      },
      include: { createdBy: { select: { fullName: true } } },
    });

    return { fileName, jsonString, log };
  } catch (error) {
    try {
      await prisma.backupLog.create({
        data: {
          fileName,
          trigger: trigger === "MANUAL" ? BackupTrigger.MANUAL : BackupTrigger.SCHEDULED,
          status: BackupStatus.FAILED,
          recordCounts,
          fileSizeBytes,
          checksumSha256,
          createdById: actorId,
        },
      });
    } catch (logError) {
      console.error("Failed to record unsuccessful backup:", logError);
    }
    throw error;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseBackupData(value: unknown): BackupData {
  if (!isObject(value)) {
    throw new BackupSnapshotValidationError("Backup file is missing its data section.");
  }

  const data = {} as BackupData;
  for (const table of BACKUP_TABLES) {
    const rows = value[table];
    if (!Array.isArray(rows) || rows.some((row) => !isObject(row))) {
      throw new BackupSnapshotValidationError(`Backup file has an invalid ${table} record list.`);
    }
    data[table] = rows as BackupRow[];
  }
  return data;
}

export function parseAndVerifyBackupSnapshot(rawContent: string): BackupSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new BackupSnapshotValidationError("Backup file is not valid JSON.");
  }

  if (!isObject(parsed) || !isObject(parsed.meta)) {
    throw new BackupSnapshotValidationError("Backup file is missing its metadata section.");
  }

  const meta = parsed.meta;
  if (
    meta.app !== APP_NAME ||
    meta.barangay !== BARANGAY_NAME ||
    meta.version !== BACKUP_VERSION ||
    typeof meta.createdAt !== "string" ||
    Number.isNaN(Date.parse(meta.createdAt)) ||
    (meta.trigger !== "MANUAL" && meta.trigger !== "SCHEDULED")
  ) {
    throw new BackupSnapshotValidationError("Backup file metadata is invalid or unsupported.");
  }

  const data = parseBackupData(parsed.data);
  const recordCounts = meta.recordCounts;
  if (!isObject(recordCounts)) {
    throw new BackupSnapshotValidationError("Backup file is missing its record counts.");
  }
  for (const table of BACKUP_TABLES) {
    if (
      !Number.isInteger(recordCounts[table]) ||
      recordCounts[table] !== data[table].length
    ) {
      throw new BackupSnapshotValidationError(`Backup file record counts do not match ${table}.`);
    }
  }

  if (
    typeof parsed.checksumSha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(parsed.checksumSha256)
  ) {
    throw new BackupSnapshotValidationError("Backup file is missing a valid SHA-256 checksum.");
  }

  const typedMeta = meta as BackupSnapshot["meta"];
  const expectedChecksum = checksumFor(typedMeta, data);
  const supplied = Buffer.from(parsed.checksumSha256, "hex");
  const expected = Buffer.from(expectedChecksum, "hex");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new BackupSnapshotValidationError(
      "Backup file failed SHA-256 integrity verification and may be corrupted or modified.",
    );
  }

  return {
    meta: typedMeta,
    data,
    checksumSha256: parsed.checksumSha256,
  };
}

const JSON_FIELDS = new Set([
  "settings",
  "uploadedFiles",
  "grades",
  "timeline",
  "educationalBackground",
  "reviewThread",
  "gradeRows",
  "ocrParsedRows",
]);

function recordToInput<T>(
  value: BackupRow,
  fields: readonly string[],
  dateFields: readonly string[] = [],
): T {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) continue;
    const fieldValue = value[field];
    if (dateFields.includes(field) && fieldValue !== null) {
      if (typeof fieldValue !== "string" && !(fieldValue instanceof Date)) {
        throw new BackupSnapshotValidationError(`Backup record has an invalid ${field} date.`);
      }
      const date = new Date(fieldValue);
      if (Number.isNaN(date.getTime())) {
        throw new BackupSnapshotValidationError(`Backup record has an invalid ${field} date.`);
      }
      result[field] = date;
    } else if (JSON_FIELDS.has(field) && fieldValue === null) {
      result[field] = Prisma.DbNull;
    } else {
      result[field] = fieldValue;
    }
  }
  return result as T;
}

function requiredRecordId(row: BackupRow) {
  if (typeof row.id !== "string" || !row.id.trim()) {
    throw new BackupSnapshotValidationError("Backup record is missing a valid id.");
  }
  return row.id;
}

async function upsertRows(
  rows: BackupRow[],
  upsert: (row: BackupRow, id: string) => Promise<unknown>,
) {
  for (const row of rows) {
    await upsert(row, requiredRecordId(row));
  }
  return rows.length;
}

async function applyRows(
  rows: BackupRow[],
  apply: (row: BackupRow) => Promise<unknown>,
) {
  for (const row of rows) {
    await apply(row);
  }
  return rows.length;
}

const ID_DATES = ["createdAt", "updatedAt"] as const;

async function restoreSnapshot(snapshot: BackupSnapshot, actorId: string) {
  const restoredCounts = {} as BackupCounts;
  const rows = snapshot.data;

  await prisma.$transaction(async (tx) => {
    restoredCounts.kkProfiles = await upsertRows(rows.kkProfiles, (row, id) =>
      tx.kKProfile.upsert({
        where: { id },
        create: recordToInput<PrismaTypes.KKProfileUncheckedCreateInput>(
          row,
          ["id", "firstName", "middleName", "lastName", "fullName", "purok", "addressLine", "barangay", "birthDate", "placeOfBirth", "contactNumber", "sex", "email", "isVerified", ...ID_DATES],
          ["birthDate", ...ID_DATES],
        ),
        update: recordToInput<PrismaTypes.KKProfileUncheckedUpdateInput>(
          row,
          ["firstName", "middleName", "lastName", "fullName", "purok", "addressLine", "barangay", "birthDate", "placeOfBirth", "contactNumber", "sex", "email", "isVerified", ...ID_DATES],
          ["birthDate", ...ID_DATES],
        ),
      }),
    );

    restoredCounts.users = await upsertRows(rows.users, async (row, id) => {
      const current = await tx.user.findUnique({ where: { id }, select: { role: true } });
      const requestedRole = row.role;
      const restoredRole =
        typeof requestedRole === "string" &&
        (Object.values(Role) as string[]).includes(requestedRole) &&
        requestedRole !== Role.SUPER_ADMIN
          ? requestedRole as Role
          : Role.YOUTH;
      const createData = recordToInput<PrismaTypes.UserUncheckedCreateInput>(
        row,
        ["id", "authId", "email", "fullName", "phoneNumber", "role", "kkStatus", "languagePref", "barangay", "isActive", ...ID_DATES, "settings", "avatarUrl", "hasSeenOnboarding", "username", "kkProfileId", "emailNotifications"],
        [...ID_DATES],
      );
      createData.role = restoredRole;

      const updateData = recordToInput<PrismaTypes.UserUncheckedUpdateInput>(
        row,
        [
          "authId",
          "email",
          "fullName",
          "phoneNumber",
          "kkStatus",
          "languagePref",
          "barangay",
          ...(id === actorId || current?.role === Role.SUPER_ADMIN ? [] : ["isActive"]),
          ...ID_DATES,
          "settings",
          "avatarUrl",
          "hasSeenOnboarding",
          "username",
          "kkProfileId",
          "emailNotifications",
        ],
        [...ID_DATES],
      );
      if (id !== actorId && current?.role !== Role.SUPER_ADMIN) {
        updateData.role = restoredRole;
      }
      return tx.user.upsert({
        where: { id },
        create: createData,
        update: updateData,
      });
    });

    restoredCounts.profilingRegistrations = await upsertRows(rows.profilingRegistrations, (row, id) =>
      tx.profilingRegistration.upsert({
        where: { id },
        create: recordToInput<PrismaTypes.ProfilingRegistrationUncheckedCreateInput>(
          row,
          ["id", "program", "userId", "fullName", "address", "sex", "age", "birthDate", "email", "facebook", "contactNumber", "civilStatus", "youthClassification", "youthAgeGroup", "workStatus", "educationalBackground", "registeredSKVoter", "votedLastSK", "registeredNationalVoter", "attendedKKAssembly", "assemblyTimes", "noAssemblyReason", "consent", "submittedAt", "reviewStatus", "withdrawnAt", "withdrawalReason", "archivedReason", "archivedAt", "archivedBy", "reviewNotes", "idBackFileUrl", "birthCertificateFileUrl", "idDocumentType", "idFrontFileUrl", "photoFileUrl", "idSingleFileUrl", "residencyStatementAcknowledgement", "middleName", "requiresManualReview"],
          ["birthDate", "submittedAt", "withdrawnAt", "archivedAt"],
        ),
        update: recordToInput<PrismaTypes.ProfilingRegistrationUncheckedUpdateInput>(
          row,
          ["program", "userId", "fullName", "address", "sex", "age", "birthDate", "email", "facebook", "contactNumber", "civilStatus", "youthClassification", "youthAgeGroup", "workStatus", "educationalBackground", "registeredSKVoter", "votedLastSK", "registeredNationalVoter", "attendedKKAssembly", "assemblyTimes", "noAssemblyReason", "consent", "submittedAt", "reviewStatus", "withdrawnAt", "withdrawalReason", "archivedReason", "archivedAt", "archivedBy", "reviewNotes", "idBackFileUrl", "birthCertificateFileUrl", "idDocumentType", "idFrontFileUrl", "photoFileUrl", "idSingleFileUrl", "residencyStatementAcknowledgement", "middleName", "requiresManualReview"],
          ["birthDate", "submittedAt", "withdrawnAt", "archivedAt"],
        ),
      }),
    );

    restoredCounts.skeapApplications = await upsertRows(rows.skeapApplications, (row, id) =>
      tx.skeapApplication.upsert({
        where: { id },
        create: recordToInput<PrismaTypes.SkeapApplicationUncheckedCreateInput>(
          row,
          ["id", "userId", "currentCourse", "yearLevel", "gwa", "enrollmentFileUrl", "reportCardFileUrl", "status", "physicalDocumentsConfirmed", "submittedAt", "updatedAt", "withdrawnAt", "withdrawalReason", "applicantName", "permanentAddress", "dateOfBirth", "placeOfBirth", "fathersName", "fathersOccupation", "fathersContact", "mothersMaidenName", "mothersOccupation", "mothersContact", "contactNumber", "emailAddress", "uploadedFiles", "photoFileUrl", "age", "civilStatus", "school", "gender", "grades", "timeline", "parentGuardianRegisteredVoter", "parentGuardianVoterFullName", "waitlistPosition", "waitlistFinalPosition", "waitlistRemark", "educationalBackground", "registeredVoter", "totalFamilyMonthlyIncome", "educationLevel"],
          ["submittedAt", "updatedAt", "withdrawnAt", "dateOfBirth"],
        ),
        update: recordToInput<PrismaTypes.SkeapApplicationUncheckedUpdateInput>(
          row,
          ["userId", "currentCourse", "yearLevel", "gwa", "enrollmentFileUrl", "reportCardFileUrl", "status", "physicalDocumentsConfirmed", "submittedAt", "updatedAt", "withdrawnAt", "withdrawalReason", "applicantName", "permanentAddress", "dateOfBirth", "placeOfBirth", "fathersName", "fathersOccupation", "fathersContact", "mothersMaidenName", "mothersOccupation", "mothersContact", "contactNumber", "emailAddress", "uploadedFiles", "photoFileUrl", "age", "civilStatus", "school", "gender", "grades", "timeline", "parentGuardianRegisteredVoter", "parentGuardianVoterFullName", "waitlistPosition", "waitlistFinalPosition", "waitlistRemark", "educationalBackground", "registeredVoter", "totalFamilyMonthlyIncome", "educationLevel"],
          ["submittedAt", "updatedAt", "withdrawnAt", "dateOfBirth"],
        ),
      }),
    );

    restoredCounts.grantees = await upsertRows(rows.grantees, (row, id) =>
      tx.grantee.upsert({
        where: { id },
        create: recordToInput<PrismaTypes.GranteeUncheckedCreateInput>(
          row,
          ["id", "userId", "status", "revocationReason", "revocationNotes", "isPermanentlyDisqualified", "identityFingerprint", "revocationNotificationStatus", "revocationNotificationAttempts", "revocationNotificationError", "revocationNotificationSentAt", "yearLevel", "entryAcademicYear", "entrySemester", "journeyStart", "journeyEnd", "school", "generalAverage", "dateEnrolled", "dateRemoved", "remarks", "createdAt", "updatedAt", "graduatedAt", "graduatedBy", "graduationReadyAt", "exitClearanceStatus", "exitClearanceUrl", "schoolClearanceVerified", "skClearanceVerified", "graduationRemarks", "retentionExpiresAt"],
          ["revocationNotificationSentAt", "dateEnrolled", "dateRemoved", "createdAt", "updatedAt", "graduatedAt", "graduationReadyAt", "retentionExpiresAt"],
        ),
        update: recordToInput<PrismaTypes.GranteeUncheckedUpdateInput>(
          row,
          ["userId", "status", "revocationReason", "revocationNotes", "isPermanentlyDisqualified", "identityFingerprint", "revocationNotificationStatus", "revocationNotificationAttempts", "revocationNotificationError", "revocationNotificationSentAt", "yearLevel", "entryAcademicYear", "entrySemester", "journeyStart", "journeyEnd", "school", "generalAverage", "dateEnrolled", "dateRemoved", "remarks", "createdAt", "updatedAt", "graduatedAt", "graduatedBy", "graduationReadyAt", "exitClearanceStatus", "exitClearanceUrl", "schoolClearanceVerified", "skClearanceVerified", "graduationRemarks", "retentionExpiresAt"],
          ["revocationNotificationSentAt", "dateEnrolled", "dateRemoved", "createdAt", "updatedAt", "graduatedAt", "graduationReadyAt", "retentionExpiresAt"],
        ),
      }),
    );

    restoredCounts.submissions = await upsertRows(rows.submissions, (row, id) =>
      tx.submission.upsert({
        where: { id },
        create: recordToInput<PrismaTypes.SubmissionUncheckedCreateInput>(
          row,
          ["id", "granteeId", "semester", "gradeFileUrl", "coeFileUrl", "generalAverage", "status", "reviewedById", "reviewNotes", "submittedAt", "reviewedAt", "physicalVerifiedBy", "physicalVerifiedAt", "flaggedFields", "coeStatus", "gradesStatus", "coeSubmittedAt", "coeApprovedAt", "gradesSubmittedAt", "gradesApprovedAt", "gradeRows", "gradeReportSemester", "ocrConfidence", "ocrGwa", "ocrParsedRows", "ocrRawText", "ocrStatus", "ocrTotalUnits", "requiresStrictManualReview", "resubmittedFields"],
          ["submittedAt", "reviewedAt", "physicalVerifiedAt", "coeSubmittedAt", "coeApprovedAt", "gradesSubmittedAt", "gradesApprovedAt"],
        ),
        update: recordToInput<PrismaTypes.SubmissionUncheckedUpdateInput>(
          row,
          ["granteeId", "semester", "gradeFileUrl", "coeFileUrl", "generalAverage", "status", "reviewedById", "reviewNotes", "submittedAt", "reviewedAt", "physicalVerifiedBy", "physicalVerifiedAt", "flaggedFields", "coeStatus", "gradesStatus", "coeSubmittedAt", "coeApprovedAt", "gradesSubmittedAt", "gradesApprovedAt", "gradeRows", "gradeReportSemester", "ocrConfidence", "ocrGwa", "ocrParsedRows", "ocrRawText", "ocrStatus", "ocrTotalUnits", "requiresStrictManualReview", "resubmittedFields"],
          ["submittedAt", "reviewedAt", "physicalVerifiedAt", "coeSubmittedAt", "coeApprovedAt", "gradesSubmittedAt", "gradesApprovedAt"],
        ),
      }),
    );

    restoredCounts.accountingPayouts = await upsertRows(rows.accountingPayouts, (row, id) =>
      tx.accountingPayout.upsert({
        where: { id },
        create: recordToInput<PrismaTypes.AccountingPayoutUncheckedCreateInput>(
          row,
          ["id", "granteeId", "amount", "semester", "status", "disbursedAt", "claimedAt", "disbursementEmailSentAt", "createdAt"],
          ["disbursedAt", "claimedAt", "disbursementEmailSentAt", "createdAt"],
        ),
        update: recordToInput<PrismaTypes.AccountingPayoutUncheckedUpdateInput>(
          row,
          ["granteeId", "amount", "semester", "status", "disbursedAt", "claimedAt", "disbursementEmailSentAt", "createdAt"],
          ["disbursedAt", "claimedAt", "disbursementEmailSentAt", "createdAt"],
        ),
      }),
    );

    restoredCounts.inquiries = await upsertRows(rows.inquiries, (row, id) =>
      tx.inquiry.upsert({
        where: { id },
        create: recordToInput<PrismaTypes.InquiryUncheckedCreateInput>(
          row,
          ["id", "userId", "subject", "message", "language", "isResolved", "response", "respondedAt", "createdAt", "reviewThread", "lastUpdatedBy", "resubmittedAt", "reviewStatus", "applicationId"],
          ["respondedAt", "createdAt", "resubmittedAt"],
        ),
        update: recordToInput<PrismaTypes.InquiryUncheckedUpdateInput>(
          row,
          ["userId", "subject", "message", "language", "isResolved", "response", "respondedAt", "createdAt", "reviewThread", "lastUpdatedBy", "resubmittedAt", "reviewStatus", "applicationId"],
          ["respondedAt", "createdAt", "resubmittedAt"],
        ),
      }),
    );

    restoredCounts.announcements = await upsertRows(rows.announcements, (row, id) =>
      tx.announcement.upsert({
        where: { id },
        create: recordToInput<PrismaTypes.AnnouncementUncheckedCreateInput>(
          row,
          ["id", "title", "content", "authorId", "isPublished", "publishedAt", "createdAt", "updatedAt", "imageUrl"],
          ["publishedAt", "createdAt", "updatedAt"],
        ),
        update: recordToInput<PrismaTypes.AnnouncementUncheckedUpdateInput>(
          row,
          ["title", "content", "authorId", "isPublished", "publishedAt", "createdAt", "updatedAt", "imageUrl"],
          ["publishedAt", "createdAt", "updatedAt"],
        ),
      }),
    );

    restoredCounts.notifications = await upsertRows(rows.notifications, (row, id) =>
      tx.notification.upsert({
        where: { id },
        create: recordToInput<PrismaTypes.NotificationUncheckedCreateInput>(
          row,
          ["id", "userId", "sourceKey", "message", "isRead", "readAt", "createdAt"],
          ["readAt", "createdAt"],
        ),
        update: recordToInput<PrismaTypes.NotificationUncheckedUpdateInput>(
          row,
          ["userId", "sourceKey", "message", "isRead", "readAt", "createdAt"],
          ["readAt", "createdAt"],
        ),
      }),
    );

    restoredCounts.notificationLogs = await upsertRows(rows.notificationLogs, (row, id) =>
      tx.notificationLog.upsert({
        where: { id },
        create: recordToInput<PrismaTypes.NotificationLogUncheckedCreateInput>(
          row,
          ["id", "userId", "type", "channel", "subject", "sentAt", "success"],
          ["sentAt"],
        ),
        update: recordToInput<PrismaTypes.NotificationLogUncheckedUpdateInput>(
          row,
          ["userId", "type", "channel", "subject", "sentAt", "success"],
          ["sentAt"],
        ),
      }),
    );

    restoredCounts.adminNotifications = await upsertRows(rows.adminNotifications, (row, id) =>
      tx.adminNotification.upsert({
        where: { id },
        create: recordToInput<PrismaTypes.AdminNotificationUncheckedCreateInput>(
          row,
          ["id", "sourceKey", "title", "message", "type", "createdAt"],
          ["createdAt"],
        ),
        update: recordToInput<PrismaTypes.AdminNotificationUncheckedUpdateInput>(
          row,
          ["sourceKey", "title", "message", "type", "createdAt"],
          ["createdAt"],
        ),
      }),
    );

    restoredCounts.granteeMessages = await upsertRows(rows.granteeMessages, (row, id) =>
      tx.granteeMessage.upsert({
        where: { id },
        create: recordToInput<PrismaTypes.GranteeMessageUncheckedCreateInput>(
          row,
          ["id", "userId", "senderId", "subject", "body", "createdAt"],
          ["createdAt"],
        ),
        update: recordToInput<PrismaTypes.GranteeMessageUncheckedUpdateInput>(
          row,
          ["userId", "senderId", "subject", "body", "createdAt"],
          ["createdAt"],
        ),
      }),
    );

    restoredCounts.registrations = await upsertRows(rows.registrations, (row, id) =>
      tx.registrations.upsert({
        where: { id },
        create: recordToInput<PrismaTypes.registrationsUncheckedCreateInput>(
          row,
          ["id", "eventId", "userId", "registeredAt", "address", "age", "contactNumber", "email", "fullName", "sex"],
          ["registeredAt"],
        ),
        update: recordToInput<PrismaTypes.registrationsUncheckedUpdateInput>(
          row,
          ["eventId", "userId", "registeredAt", "address", "age", "contactNumber", "email", "fullName", "sex"],
          ["registeredAt"],
        ),
      }),
    );

    restoredCounts.systemSettings = await upsertRows(rows.systemSettings, async (row, id) =>
      tx.systemSetting.upsert({
        where: { key: typeof row.key === "string" ? row.key : id },
        create: recordToInput<PrismaTypes.SystemSettingCreateInput>(
          row,
          ["id", "key", "value", "updatedAt"],
          ["updatedAt"],
        ),
        update: recordToInput<PrismaTypes.SystemSettingUpdateInput>(
          row,
          ["value", "updatedAt"],
          ["updatedAt"],
        ),
      }),
    );

    restoredCounts.adminSettings = await applyRows(rows.adminSettings, (row) => {
      if (typeof row.key !== "string" || !row.key) {
        throw new BackupSnapshotValidationError("Backup admin setting is missing its key.");
      }
      return tx.adminSettings.upsert({
        where: { key: row.key },
        create: recordToInput<PrismaTypes.AdminSettingsCreateInput>(row, ["key", "totalBudget"]),
        update: recordToInput<PrismaTypes.AdminSettingsUpdateInput>(row, ["totalBudget"]),
      });
    });

    restoredCounts.academicTermSchedules = await upsertRows(rows.academicTermSchedules, (row, id) =>
      tx.academicTermSchedule.upsert({
        where: { id },
        create: recordToInput<PrismaTypes.AcademicTermScheduleUncheckedCreateInput>(
          row,
          ["id", "semester", "opensAt", "closesAt", "createdAt", "updatedAt"],
          ["opensAt", "closesAt", "createdAt", "updatedAt"],
        ),
        update: recordToInput<PrismaTypes.AcademicTermScheduleUncheckedUpdateInput>(
          row,
          ["semester", "opensAt", "closesAt", "createdAt", "updatedAt"],
          ["opensAt", "closesAt", "createdAt", "updatedAt"],
        ),
      }),
    );

    restoredCounts.semesters = await upsertRows(rows.semesters, (row, id) =>
      tx.semester.upsert({
        where: { id },
        create: recordToInput<PrismaTypes.SemesterCreateInput>(row, ["id", "name", "isCurrent"]),
        update: recordToInput<PrismaTypes.SemesterUpdateInput>(row, ["name", "isCurrent"]),
      }),
    );

    restoredCounts.reminderSettings = await applyRows(rows.reminderSettings, (row) => {
      if (typeof row.type !== "string") {
        throw new BackupSnapshotValidationError("Backup reminder setting is missing its type.");
      }
      return tx.reminderSetting.upsert({
        where: { type: row.type as ReminderType },
        create: recordToInput<PrismaTypes.ReminderSettingCreateInput>(
          row,
          ["type", "offsets", "deadline", "active", "createdAt", "updatedAt"],
          ["deadline", "createdAt", "updatedAt"],
        ),
        update: recordToInput<PrismaTypes.ReminderSettingUpdateInput>(
          row,
          ["offsets", "deadline", "active", "createdAt", "updatedAt"],
          ["deadline", "createdAt", "updatedAt"],
        ),
      });
    });

    restoredCounts.messageTemplates = await applyRows(rows.messageTemplates, (row) => {
      if (typeof row.type !== "string" || typeof row.channel !== "string") {
        throw new BackupSnapshotValidationError("Backup message template is missing its type or channel.");
      }
      const type = row.type as MessageTemplateType;
      const channel = row.channel as MessageTemplateChannel;
      return tx.messageTemplate.upsert({
        where: { type_channel: { type, channel } },
        create: recordToInput<PrismaTypes.MessageTemplateCreateInput>(
          row,
          ["type", "channel", "subject", "body", "createdAt", "updatedAt"],
          ["createdAt", "updatedAt"],
        ),
        update: recordToInput<PrismaTypes.MessageTemplateUpdateInput>(
          row,
          ["subject", "body", "createdAt", "updatedAt"],
          ["createdAt", "updatedAt"],
        ),
      });
    });

    await writeAuditLog(tx, {
      action: "RESTORE_SYSTEM_BACKUP",
      actorId,
      targetTable: "backup_snapshot",
      targetId: snapshot.checksumSha256,
      afterData: { restoredCounts },
      metadata: {
        checksumSha256: snapshot.checksumSha256,
        snapshotCreatedAt: snapshot.meta.createdAt,
        restoredCounts,
      },
    });
  });

  try {
    await Promise.all([
      refreshSkeapApplicationsAdminView(),
      refreshKkProfilingApplicationsAdminView(),
    ]);
  } catch (error) {
    console.error("Backup restore committed but materialized views could not be refreshed:", error);
    throw new BackupRestoreCommittedError();
  }

  return restoredCounts;
}

export async function verifyAndRestoreBackupSnapshot({
  rawContent,
  actorId,
}: {
  rawContent: string;
  actorId: string;
}) {
  const snapshot = parseAndVerifyBackupSnapshot(rawContent);
  const restoredCounts = await restoreSnapshot(snapshot, actorId);
  return { restoredCounts, checksumSha256: snapshot.checksumSha256 };
}

export const backupTableNames = BACKUP_TABLES;
