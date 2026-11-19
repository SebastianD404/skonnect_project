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
import {
  persistSystemBackup,
  removeScheduledBackupFiles,
} from "@/lib/data-backup-storage";
import { getPhtDateString } from "@/lib/data-backup-schedule";

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
export type BackupTriggerInput = "MANUAL" | "AUTOMATED" | "SCHEDULED";
export type BackupCounts = Record<BackupTable, number>;
export type BackupRestoreSummary = {
  created: number;
  updated: number;
  skipped: number;
};

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
  constructor(message: string, readonly code = "INVALID_SCHEMA") {
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
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `skonnect-backup-${values.year}-${values.month}-${values.day}-${values.hour}${values.minute}${values.second}.json`;
}

function checksumFor(meta: BackupSnapshot["meta"], data: BackupData) {
  const checksumBuffer = Buffer.from(JSON.stringify({ meta, data }), "utf8");
  return createHash("sha256").update(checksumBuffer).digest("hex");
}

function getBackupErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Unknown backup error.";
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
  createdByLabel: requestedCreatedByLabel,
}: {
  actorId: string | null;
  trigger: BackupTriggerInput;
  createdByLabel?: string;
}) {
  const createdAt = new Date();
  const fileName = createFileName(createdAt);
  let recordCounts: Record<string, number> = {};
  let fileSizeBytes = 0;
  let checksumSha256 = "";
  let storagePath: string | null = null;
  const triggerType = trigger === "MANUAL"
    ? BackupTrigger.MANUAL
    : trigger === "SCHEDULED"
      ? BackupTrigger.SCHEDULED
      : BackupTrigger.AUTOMATED;
  const createdByLabel = requestedCreatedByLabel ??
    (trigger === "MANUAL" ? null : "System Cron");

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
    const jsonBuffer = Buffer.from(jsonString, "utf8");
    fileSizeBytes = jsonBuffer.byteLength;
    storagePath = await persistSystemBackup(
      trigger === "MANUAL" ? "MANUAL" : "SCHEDULED",
      getPhtDateString(createdAt),
      fileName,
      jsonBuffer,
    );

    try {
      const log = await prisma.backupLog.create({
        data: {
          fileName,
          trigger: triggerType,
          status: BackupStatus.COMPLETED,
          recordCounts,
          fileSizeBytes,
          checksumSha256,
          storagePath,
          createdByLabel,
          createdById: actorId,
        },
        include: { createdBy: { select: { fullName: true } } },
      });

      if (trigger !== "MANUAL") {
        try {
          await pruneScheduledBackupHistory();
        } catch (pruneError) {
          console.error("Scheduled backup retention pruning failed:", pruneError);
        }
      }

      return { fileName, jsonString, log };
    } catch (logError) {
      console.error("Failed to insert completed backup metadata:", logError);
      throw logError;
    }

  } catch (error) {
    try {
      await prisma.backupLog.create({
        data: {
          fileName,
          trigger: triggerType,
          status: BackupStatus.FAILED,
          recordCounts,
          fileSizeBytes,
          checksumSha256,
          storagePath,
          createdByLabel,
          errorMessage: getBackupErrorMessage(error).slice(0, 1000),
          createdById: actorId,
        },
      });
    } catch (logError) {
      console.error("Failed to record unsuccessful backup; preserving the original backup error:", logError);
    }
    throw error;
  }
}

export async function pruneScheduledBackupHistory(now = new Date()) {
  const retentionCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oldBackups = await prisma.backupLog.findMany({
    where: {
      trigger: { in: [BackupTrigger.AUTOMATED, BackupTrigger.SCHEDULED] },
      createdAt: { lt: retentionCutoff },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      storagePath: true,
    },
  });
  if (oldBackups.length === 0) return 0;

  const storagePaths = oldBackups.map(
    (backup) => backup.storagePath ?? `scheduled/${backup.fileName}`,
  );
  await removeScheduledBackupFiles(storagePaths);
  await prisma.backupLog.deleteMany({
    where: { id: { in: oldBackups.map((backup) => backup.id) } },
  });

  return oldBackups.length;
}

export async function pruneAutomatedBackupHistory(now = new Date()) {
  return pruneScheduledBackupHistory(now);
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
    (meta.trigger !== "MANUAL" &&
      meta.trigger !== "AUTOMATED" &&
      meta.trigger !== "SCHEDULED")
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
      "CHECKSUM_MISMATCH",
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

type RestorePlan<CreateData> = {
  matchKeys: string[];
  createData: CreateData;
  updateData?: Record<string, unknown>;
  updateOperation: (matchedKeys: string[]) => Promise<unknown>;
};

function normalizeRestoreValue(value: unknown): unknown {
  if (value === Prisma.DbNull || value === Prisma.JsonNull) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(normalizeRestoreValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeRestoreValue(entry)]),
    );
  }
  return value;
}

function restoreValuesEqual(existing: Record<string, unknown>, incoming: Record<string, unknown>) {
  return Object.entries(incoming).every(([field, value]) =>
    JSON.stringify(normalizeRestoreValue(existing[field])) ===
    JSON.stringify(normalizeRestoreValue(value)),
  );
}

function getRestoreMatchKeys(row: unknown) {
  if (!row || typeof row !== "object") return [];
  const record = row as Record<string, unknown>;
  const keys: string[] = [];
  if (typeof record.id === "string") keys.push(idMatchKey(record.id));
  if (typeof record.key === "string") keys.push(`key:${record.key}`);
  if (typeof record.type === "string" && typeof record.channel === "string") {
    keys.push(`type:${record.type};channel:${record.channel}`);
  } else if (typeof record.type === "string") {
    keys.push(`type:${record.type}`);
  }
  return keys;
}

type TableRestoreCounts = {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
};

function getCreateManyCount(result: unknown, fallback: number) {
  return result && typeof result === "object" &&
      "count" in result &&
      typeof result.count === "number"
    ? result.count
    : fallback;
}

async function runUpdateBatches(operations: (() => Promise<unknown>)[]) {
  for (let index = 0; index < operations.length; index += 15) {
    await Promise.all(operations.slice(index, index + 15).map((operation) => operation()));
  }
}

async function restoreRows<ExistingRow, CreateData>(
  rows: BackupRow[],
  loadExistingRows: () => Promise<ExistingRow[]>,
  createMany: (data: CreateData[]) => Promise<unknown>,
  createPlan: (row: BackupRow) => RestorePlan<CreateData>,
): Promise<TableRestoreCounts> {
  const existingByKey = new Map<string, ExistingRow>();
  const plannedCreatesByKey = new Map<string, Record<string, unknown>>();
  for (const existingRow of await loadExistingRows()) {
    for (const key of getRestoreMatchKeys(existingRow)) {
      existingByKey.set(key, existingRow);
    }
  }

  const createData: CreateData[] = [];
  const updateOperations: (() => Promise<unknown>)[] = [];
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const plan = createPlan(row);
    const existing = plan.matchKeys
      .map((key) => existingByKey.get(key))
      .find((record): record is ExistingRow => record !== undefined);
    const plannedCreate = plan.matchKeys
      .map((key) => plannedCreatesByKey.get(key))
      .find((record): record is Record<string, unknown> => record !== undefined);
    const currentRecord = (existing as Record<string, unknown> | undefined) ?? plannedCreate;
    const updateData = plan.updateData ?? Object.fromEntries(
      Object.entries(plan.createData as Record<string, unknown>)
        .filter(([field]) => field !== "id"),
    );

    if (currentRecord) {
      if (restoreValuesEqual(currentRecord, updateData)) {
        skipped += 1;
      } else {
        const matchedKeys = plan.matchKeys.filter((key) =>
          existingByKey.has(key) || plannedCreatesByKey.has(key),
        );
        updateOperations.push(() => plan.updateOperation(matchedKeys));
        updated += 1;
      }
    } else {
      createData.push(plan.createData);
      const createRecord = plan.createData as Record<string, unknown>;
      for (const key of plan.matchKeys) plannedCreatesByKey.set(key, createRecord);
    }
  }

  let created = 0;
  if (createData.length > 0) {
    created = getCreateManyCount(await createMany(createData), createData.length);
  }
  await runUpdateBatches(updateOperations);
  skipped += Math.max(0, rows.length - created - updated - skipped);
  return { processed: rows.length, created, updated, skipped };
}

function idMatchKey(id: string) {
  return `id:${id}`;
}

function requiredStringField(row: BackupRow, field: string, message: string) {
  const value = row[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new BackupSnapshotValidationError(message);
  }
  return value.trim();
}

const ID_DATES = ["createdAt", "updatedAt"] as const;

function remapUserReferences(
  row: BackupRow,
  userIdMap: Map<string, string>,
  fields: readonly string[],
): BackupRow {
  const mapped = { ...row };
  for (const field of fields) {
    const value = row[field];
    if (typeof value === "string") mapped[field] = userIdMap.get(value) ?? value;
  }
  return mapped;
}

async function restoreSnapshot(snapshot: BackupSnapshot, actorId: string) {
  const restoredCounts = {} as BackupCounts;
  const restoreSummary: BackupRestoreSummary = { created: 0, updated: 0, skipped: 0 };
  const rows = snapshot.data;
  const userIdMap = new Map<string, string>();
  const existingUsers = await prisma.user.findMany();
  const existingUsersById = new Map(existingUsers.map((user) => [user.id, user]));
  const usersById = new Map<string, Record<string, unknown>>();
  const usersByEmail = new Map<string, Record<string, unknown>>();
  for (const user of existingUsers) {
    usersById.set(user.id, { ...user });
    const email = user.email.trim().toLowerCase();
    if (!email) continue;
    const duplicate = usersByEmail.get(email);
    if (duplicate && duplicate.id !== user.id) {
      throw new BackupSnapshotValidationError(
        "Existing user records contain duplicate normalized email addresses.",
        "USER_EMAIL_CONFLICT",
      );
    }
    usersByEmail.set(email, usersById.get(user.id)!);
  }

  const userCreateData: PrismaTypes.UserCreateManyInput[] = [];
  const userUpdates: (() => Promise<unknown>)[] = [];
  const updatedUserIds = new Set<string>();
  const createdUserIds = new Set<string>();
  for (const row of rows.users) {
    const id = requiredRecordId(row);
    const email = requiredStringField(
      row,
      "email",
      "Backup user is missing a valid email address.",
    );
    if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
      throw new BackupSnapshotValidationError("Backup user has an invalid email address.");
    }
    const normalizedEmail = email.toLowerCase();
    const idMatch = usersById.get(id);
    const emailMatch = usersByEmail.get(normalizedEmail);
    if (idMatch && emailMatch && idMatch.id !== emailMatch.id) {
      throw new BackupSnapshotValidationError(
        "A backup user ID and email match different existing accounts.",
        "USER_ID_EMAIL_CONFLICT",
      );
    }

    const current = idMatch ?? emailMatch;
    const targetId = typeof current?.id === "string" ? current.id : id;
    userIdMap.set(id, targetId);
    const requestedRole = row.role;
    const restoredRole =
      typeof requestedRole === "string" &&
      (Object.values(Role) as string[]).includes(requestedRole) &&
      requestedRole !== Role.SUPER_ADMIN
        ? requestedRole as Role
        : Role.YOUTH;

    if (current) {
      const isExistingUser = existingUsersById.has(targetId);
      const protectedAccount =
        targetId === actorId ||
        current.role === Role.SUPER_ADMIN ||
        (current.role as string) === "SK_ADMIN";
      const updateData = recordToInput<PrismaTypes.UserUncheckedUpdateInput>(
        row,
        [
          "fullName",
          "phoneNumber",
          "kkStatus",
          "languagePref",
          "barangay",
          ...(protectedAccount ? [] : ["isActive"]),
          ...ID_DATES,
          "settings",
          "avatarUrl",
          "hasSeenOnboarding",
          "emailNotifications",
        ],
        [...ID_DATES],
      );
      if (!protectedAccount) updateData.role = restoredRole;
      if (restoreValuesEqual(current, updateData)) continue;
      userUpdates.push(() => prisma.user.update({ where: { id: targetId }, data: updateData }));
      if (isExistingUser) updatedUserIds.add(targetId);
      Object.assign(current, updateData);
    } else {
      const createData = recordToInput<PrismaTypes.UserCreateManyInput>(
        { ...row, email: normalizedEmail },
        [
          "id",
          "authId",
          "email",
          "fullName",
          "phoneNumber",
          "role",
          "kkStatus",
          "languagePref",
          "barangay",
          "isActive",
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
      createData.role = restoredRole;
      createData.kkProfileId = null;
      userCreateData.push(createData);
      createdUserIds.add(targetId);

      const restoredUser = { ...createData, id: targetId, email: normalizedEmail };
      usersById.set(id, restoredUser);
      usersByEmail.set(normalizedEmail, restoredUser);
    }
  }
  let createdUserCount = 0;
  if (userCreateData.length > 0) {
    createdUserCount = getCreateManyCount(
      await prisma.user.createMany({ data: userCreateData, skipDuplicates: true }),
      userCreateData.length,
    );
  }
  await runUpdateBatches(userUpdates);
  restoreSummary.created += createdUserCount;

  const restoreTableRows = async <ExistingRow, CreateData>(
    tableRows: BackupRow[],
    loadExistingRows: () => Promise<ExistingRow[]>,
    createMany: (data: CreateData[]) => Promise<unknown>,
    createPlan: (row: BackupRow) => RestorePlan<CreateData>,
  ) => {
    const counts = await restoreRows(tableRows, loadExistingRows, createMany, createPlan);
    restoreSummary.created += counts.created;
    restoreSummary.updated += counts.updated;
    restoreSummary.skipped += counts.skipped;
    return counts.processed;
  };

  restoredCounts.users = rows.users.length;
  restoredCounts.kkProfiles = await restoreTableRows(
    rows.kkProfiles,
    () => prisma.kKProfile.findMany(),
    (data: PrismaTypes.KKProfileCreateManyInput[]) =>
      prisma.kKProfile.createMany({ data, skipDuplicates: true }),
    (row) => {
      const id = requiredRecordId(row);
      const fields = ["id", "firstName", "middleName", "lastName", "fullName", "purok", "addressLine", "barangay", "birthDate", "placeOfBirth", "contactNumber", "sex", "email", "isVerified", ...ID_DATES];
      return {
        matchKeys: [idMatchKey(id)],
        createData: recordToInput<PrismaTypes.KKProfileCreateManyInput>(row, fields, ["birthDate", ...ID_DATES]),
        updateOperation: () => prisma.kKProfile.update({
          where: { id },
          data: recordToInput<PrismaTypes.KKProfileUncheckedUpdateInput>(row, fields, ["birthDate", ...ID_DATES]),
        }),
      };
    },
  );

  const profileLinkUpdates: (() => Promise<unknown>)[] = [];
  for (const row of rows.users) {
    const profileId = row.kkProfileId;
    if (typeof profileId !== "string") continue;
    const id = requiredRecordId(row);
    const targetId = userIdMap.get(id) ?? id;
    const current = usersById.get(targetId);
    if (current?.kkProfileId === profileId) continue;
    profileLinkUpdates.push(() => prisma.user.update({
      where: { id: targetId },
      data: { kkProfileId: profileId },
    }));
    if (existingUsersById.has(targetId) && !createdUserIds.has(targetId)) {
      updatedUserIds.add(targetId);
    }
    if (current) current.kkProfileId = profileId;
  }
  await runUpdateBatches(profileLinkUpdates);
  restoreSummary.updated += updatedUserIds.size;
  restoreSummary.skipped += Math.max(0, rows.users.length - createdUserCount - updatedUserIds.size);

  restoredCounts.profilingRegistrations = await restoreTableRows(
    rows.profilingRegistrations,
    () => prisma.profilingRegistration.findMany(),
    (data: PrismaTypes.ProfilingRegistrationCreateManyInput[]) =>
      prisma.profilingRegistration.createMany({ data, skipDuplicates: true }),
    (row) => {
      const id = requiredRecordId(row);
      const mapped = remapUserReferences(row, userIdMap, ["userId", "archivedBy"]);
      const createFields = ["id", "program", "userId", "fullName", "address", "sex", "age", "birthDate", "email", "facebook", "contactNumber", "civilStatus", "youthClassification", "youthAgeGroup", "workStatus", "educationalBackground", "registeredSKVoter", "votedLastSK", "registeredNationalVoter", "attendedKKAssembly", "assemblyTimes", "noAssemblyReason", "consent", "submittedAt", "reviewStatus", "withdrawnAt", "withdrawalReason", "archivedReason", "archivedAt", "archivedBy", "reviewNotes", "idBackFileUrl", "birthCertificateFileUrl", "idDocumentType", "idFrontFileUrl", "photoFileUrl", "idSingleFileUrl", "residencyStatementAcknowledgement", "middleName", "requiresManualReview"];
      const updateFields = ["program", "userId", "fullName", "address", "sex", "age", "birthDate", "email", "facebook", "contactNumber", "civilStatus", "youthClassification", "youthAgeGroup", "workStatus", "educationalBackground", "registeredSKVoter", "votedLastSK", "registeredNationalVoter", "attendedKKAssembly", "assemblyTimes", "noAssemblyReason", "consent", "submittedAt", "reviewStatus", "withdrawnAt", "withdrawalReason", "archivedReason", "archivedAt", "archivedBy", "reviewNotes", "idBackFileUrl", "birthCertificateFileUrl", "idDocumentType", "idFrontFileUrl", "photoFileUrl", "idSingleFileUrl", "residencyStatementAcknowledgement", "middleName", "requiresManualReview"];
      return {
        matchKeys: [idMatchKey(id)],
        createData: recordToInput<PrismaTypes.ProfilingRegistrationCreateManyInput>(mapped, createFields, ["birthDate", "submittedAt", "withdrawnAt", "archivedAt"]),
        updateOperation: () => prisma.profilingRegistration.update({
          where: { id },
          data: recordToInput<PrismaTypes.ProfilingRegistrationUncheckedUpdateInput>(mapped, updateFields, ["birthDate", "submittedAt", "withdrawnAt", "archivedAt"]),
        }),
      };
    },
  );

  restoredCounts.skeapApplications = await restoreTableRows(
    rows.skeapApplications,
    () => prisma.skeapApplication.findMany(),
    (data: PrismaTypes.SkeapApplicationCreateManyInput[]) =>
      prisma.skeapApplication.createMany({ data, skipDuplicates: true }),
    (row) => {
      const id = requiredRecordId(row);
      const mapped = remapUserReferences(row, userIdMap, ["userId"]);
      const fields = ["id", "userId", "currentCourse", "yearLevel", "gwa", "enrollmentFileUrl", "reportCardFileUrl", "status", "physicalDocumentsConfirmed", "submittedAt", "updatedAt", "withdrawnAt", "withdrawalReason", "applicantName", "permanentAddress", "dateOfBirth", "placeOfBirth", "fathersName", "fathersOccupation", "fathersContact", "mothersMaidenName", "mothersOccupation", "mothersContact", "contactNumber", "emailAddress", "uploadedFiles", "photoFileUrl", "age", "civilStatus", "school", "gender", "grades", "timeline", "parentGuardianRegisteredVoter", "parentGuardianVoterFullName", "waitlistPosition", "waitlistFinalPosition", "waitlistRemark", "educationalBackground", "registeredVoter", "totalFamilyMonthlyIncome", "educationLevel"];
      const dateFields = ["submittedAt", "updatedAt", "withdrawnAt", "dateOfBirth"];
      const updateFields = fields.filter((field) => field !== "id");
      return {
        matchKeys: [idMatchKey(id)],
        createData: recordToInput<PrismaTypes.SkeapApplicationCreateManyInput>(mapped, fields, dateFields),
        updateOperation: () => prisma.skeapApplication.update({
          where: { id },
          data: recordToInput<PrismaTypes.SkeapApplicationUncheckedUpdateInput>(mapped, updateFields, dateFields),
        }),
      };
    },
  );

  restoredCounts.grantees = await restoreTableRows(
    rows.grantees,
    () => prisma.grantee.findMany(),
    (data: PrismaTypes.GranteeCreateManyInput[]) =>
      prisma.grantee.createMany({ data, skipDuplicates: true }),
    (row) => {
      const id = requiredRecordId(row);
      const mapped = remapUserReferences(row, userIdMap, ["userId", "graduatedBy"]);
      const fields = ["id", "userId", "status", "revocationReason", "revocationNotes", "isPermanentlyDisqualified", "identityFingerprint", "revocationNotificationStatus", "revocationNotificationAttempts", "revocationNotificationError", "revocationNotificationSentAt", "yearLevel", "entryAcademicYear", "entrySemester", "journeyStart", "journeyEnd", "journeyStartAcademicYear", "journeyStartSemester", "journeyEndSemester", "school", "generalAverage", "dateEnrolled", "dateRemoved", "remarks", "createdAt", "updatedAt", "graduatedAt", "graduatedBy", "graduationReadyAt", "exitClearanceStatus", "exitClearanceUrl", "schoolClearanceVerified", "skClearanceVerified", "graduationRemarks", "retentionExpiresAt"];
      const dateFields = ["revocationNotificationSentAt", "dateEnrolled", "dateRemoved", "createdAt", "updatedAt", "graduatedAt", "graduationReadyAt", "retentionExpiresAt"];
      return {
        matchKeys: [idMatchKey(id)],
        createData: recordToInput<PrismaTypes.GranteeCreateManyInput>(mapped, fields, dateFields),
        updateOperation: () => prisma.grantee.update({
          where: { id },
          data: recordToInput<PrismaTypes.GranteeUncheckedUpdateInput>(mapped, fields.filter((field) => field !== "id"), dateFields),
        }),
      };
    },
  );

  restoredCounts.submissions = await restoreTableRows(
    rows.submissions,
    () => prisma.submission.findMany(),
    (data: PrismaTypes.SubmissionCreateManyInput[]) =>
      prisma.submission.createMany({ data, skipDuplicates: true }),
    (row) => {
      const id = requiredRecordId(row);
      const mapped = remapUserReferences(row, userIdMap, ["reviewedById", "physicalVerifiedBy"]);
      const fields = ["id", "granteeId", "semester", "gradeFileUrl", "coeFileUrl", "generalAverage", "status", "reviewedById", "reviewNotes", "submittedAt", "reviewedAt", "physicalVerifiedBy", "physicalVerifiedAt", "flaggedFields", "coeStatus", "gradesStatus", "coeSubmittedAt", "coeApprovedAt", "gradesSubmittedAt", "gradesApprovedAt", "gradeRows", "gradeReportSemester", "ocrConfidence", "ocrGwa", "ocrParsedRows", "ocrRawText", "ocrStatus", "ocrTotalUnits", "requiresStrictManualReview", "resubmittedFields"];
      const dateFields = ["submittedAt", "reviewedAt", "physicalVerifiedAt", "coeSubmittedAt", "coeApprovedAt", "gradesSubmittedAt", "gradesApprovedAt"];
      return {
        matchKeys: [idMatchKey(id)],
        createData: recordToInput<PrismaTypes.SubmissionCreateManyInput>(mapped, fields, dateFields),
        updateOperation: () => prisma.submission.update({
          where: { id },
          data: recordToInput<PrismaTypes.SubmissionUncheckedUpdateInput>(mapped, fields.filter((field) => field !== "id"), dateFields),
        }),
      };
    },
  );

  restoredCounts.accountingPayouts = await restoreTableRows(
    rows.accountingPayouts,
    () => prisma.accountingPayout.findMany(),
    (data: PrismaTypes.AccountingPayoutCreateManyInput[]) =>
      prisma.accountingPayout.createMany({ data, skipDuplicates: true }),
    (row) => {
      const id = requiredRecordId(row);
      const fields = ["id", "granteeId", "amount", "semester", "status", "disbursedAt", "claimedAt", "disbursementEmailSentAt", "createdAt"];
      const dateFields = ["disbursedAt", "claimedAt", "disbursementEmailSentAt", "createdAt"];
      return {
        matchKeys: [idMatchKey(id)],
        createData: recordToInput<PrismaTypes.AccountingPayoutCreateManyInput>(row, fields, dateFields),
        updateOperation: () => prisma.accountingPayout.update({
          where: { id },
          data: recordToInput<PrismaTypes.AccountingPayoutUncheckedUpdateInput>(row, fields.filter((field) => field !== "id"), dateFields),
        }),
      };
    },
  );

  restoredCounts.inquiries = await restoreTableRows(
    rows.inquiries,
    () => prisma.inquiry.findMany(),
    (data: PrismaTypes.InquiryCreateManyInput[]) =>
      prisma.inquiry.createMany({ data, skipDuplicates: true }),
    (row) => {
      const id = requiredRecordId(row);
      const mapped = remapUserReferences(row, userIdMap, ["userId", "lastUpdatedBy"]);
      const fields = ["id", "userId", "subject", "message", "language", "isResolved", "response", "respondedAt", "createdAt", "reviewThread", "lastUpdatedBy", "resubmittedAt", "reviewStatus", "applicationId"];
      const dateFields = ["respondedAt", "createdAt", "resubmittedAt"];
      return {
        matchKeys: [idMatchKey(id)],
        createData: recordToInput<PrismaTypes.InquiryCreateManyInput>(mapped, fields, dateFields),
        updateOperation: () => prisma.inquiry.update({
          where: { id },
          data: recordToInput<PrismaTypes.InquiryUncheckedUpdateInput>(mapped, fields.filter((field) => field !== "id"), dateFields),
        }),
      };
    },
  );

  restoredCounts.announcements = await restoreTableRows(
    rows.announcements,
    () => prisma.announcement.findMany(),
    (data: PrismaTypes.AnnouncementCreateManyInput[]) =>
      prisma.announcement.createMany({ data, skipDuplicates: true }),
    (row) => {
      const id = requiredRecordId(row);
      const mapped = remapUserReferences(row, userIdMap, ["authorId"]);
      const fields = ["id", "title", "content", "authorId", "isPublished", "publishedAt", "createdAt", "updatedAt", "imageUrl"];
      const dateFields = ["publishedAt", "createdAt", "updatedAt"];
      return {
        matchKeys: [idMatchKey(id)],
        createData: recordToInput<PrismaTypes.AnnouncementCreateManyInput>(mapped, fields, dateFields),
        updateOperation: () => prisma.announcement.update({
          where: { id },
          data: recordToInput<PrismaTypes.AnnouncementUncheckedUpdateInput>(mapped, fields.filter((field) => field !== "id"), dateFields),
        }),
      };
    },
  );

  restoredCounts.notifications = await restoreTableRows(
    rows.notifications,
    () => prisma.notification.findMany(),
    (data: PrismaTypes.NotificationCreateManyInput[]) =>
      prisma.notification.createMany({ data, skipDuplicates: true }),
    (row) => {
      const id = requiredRecordId(row);
      const mapped = remapUserReferences(row, userIdMap, ["userId"]);
      const fields = ["id", "userId", "sourceKey", "message", "isRead", "readAt", "createdAt"];
      const dateFields = ["readAt", "createdAt"];
      return {
        matchKeys: [idMatchKey(id)],
        createData: recordToInput<PrismaTypes.NotificationCreateManyInput>(mapped, fields, dateFields),
        updateOperation: () => prisma.notification.update({
          where: { id },
          data: recordToInput<PrismaTypes.NotificationUncheckedUpdateInput>(mapped, fields.filter((field) => field !== "id"), dateFields),
        }),
      };
    },
  );

  restoredCounts.notificationLogs = await restoreTableRows(
    rows.notificationLogs,
    () => prisma.notificationLog.findMany(),
    (data: PrismaTypes.NotificationLogCreateManyInput[]) =>
      prisma.notificationLog.createMany({ data, skipDuplicates: true }),
    (row) => {
      const id = requiredRecordId(row);
      const mapped = remapUserReferences(row, userIdMap, ["userId"]);
      const fields = ["id", "userId", "type", "channel", "subject", "sentAt", "success"];
      return {
        matchKeys: [idMatchKey(id)],
        createData: recordToInput<PrismaTypes.NotificationLogCreateManyInput>(mapped, fields, ["sentAt"]),
        updateOperation: () => prisma.notificationLog.update({
          where: { id },
          data: recordToInput<PrismaTypes.NotificationLogUncheckedUpdateInput>(mapped, fields.filter((field) => field !== "id"), ["sentAt"]),
        }),
      };
    },
  );

  restoredCounts.adminNotifications = await restoreTableRows(
    rows.adminNotifications,
    () => prisma.adminNotification.findMany(),
    (data: PrismaTypes.AdminNotificationCreateManyInput[]) =>
      prisma.adminNotification.createMany({ data, skipDuplicates: true }),
    (row) => {
      const id = requiredRecordId(row);
      const fields = ["id", "sourceKey", "title", "message", "type", "href", "createdAt"];
      return {
        matchKeys: [idMatchKey(id)],
        createData: recordToInput<PrismaTypes.AdminNotificationCreateManyInput>(row, fields, ["createdAt"]),
        updateOperation: () => prisma.adminNotification.update({
          where: { id },
          data: recordToInput<PrismaTypes.AdminNotificationUncheckedUpdateInput>(row, fields.filter((field) => field !== "id"), ["createdAt"]),
        }),
      };
    },
  );

  restoredCounts.granteeMessages = await restoreTableRows(
    rows.granteeMessages,
    () => prisma.granteeMessage.findMany(),
    (data: PrismaTypes.GranteeMessageCreateManyInput[]) =>
      prisma.granteeMessage.createMany({ data, skipDuplicates: true }),
    (row) => {
      const id = requiredRecordId(row);
      const mapped = remapUserReferences(row, userIdMap, ["userId", "senderId"]);
      const fields = ["id", "userId", "senderId", "subject", "body", "createdAt"];
      return {
        matchKeys: [idMatchKey(id)],
        createData: recordToInput<PrismaTypes.GranteeMessageCreateManyInput>(mapped, fields, ["createdAt"]),
        updateOperation: () => prisma.granteeMessage.update({
          where: { id },
          data: recordToInput<PrismaTypes.GranteeMessageUncheckedUpdateInput>(mapped, fields.filter((field) => field !== "id"), ["createdAt"]),
        }),
      };
    },
  );

  restoredCounts.registrations = await restoreTableRows(
    rows.registrations,
    () => prisma.registrations.findMany(),
    (data: PrismaTypes.registrationsCreateManyInput[]) =>
      prisma.registrations.createMany({ data, skipDuplicates: true }),
    (row) => {
      const id = requiredRecordId(row);
      const mapped = remapUserReferences(row, userIdMap, ["userId"]);
      const fields = ["id", "eventId", "userId", "registeredAt", "address", "age", "contactNumber", "email", "fullName", "sex"];
      return {
        matchKeys: [idMatchKey(id)],
        createData: recordToInput<PrismaTypes.registrationsCreateManyInput>(mapped, fields, ["registeredAt"]),
        updateOperation: () => prisma.registrations.update({
          where: { id },
          data: recordToInput<PrismaTypes.registrationsUncheckedUpdateInput>(mapped, fields.filter((field) => field !== "id"), ["registeredAt"]),
        }),
      };
    },
  );

  restoredCounts.systemSettings = await restoreTableRows(
    rows.systemSettings,
    () => prisma.systemSetting.findMany(),
    (data: PrismaTypes.SystemSettingCreateManyInput[]) =>
      prisma.systemSetting.createMany({ data, skipDuplicates: true }),
    (row) => {
      const id = requiredRecordId(row);
      const key = requiredStringField(row, "key", "Backup system setting is missing its key.");
      const matchKey = `key:${key}`;
      return {
        matchKeys: [idMatchKey(id), matchKey],
        createData: recordToInput<PrismaTypes.SystemSettingCreateManyInput>(row, ["id", "key", "value", "updatedAt"], ["updatedAt"]),
        updateData: recordToInput<PrismaTypes.SystemSettingUpdateManyMutationInput>(row, ["value", "updatedAt"], ["updatedAt"]),
        updateOperation: (matchedKeys) => prisma.systemSetting.update({
          where: matchedKeys.includes(idMatchKey(id)) ? { id } : { key },
          data: recordToInput<PrismaTypes.SystemSettingUpdateManyMutationInput>(row, ["value", "updatedAt"], ["updatedAt"]),
        }),
      };
    },
  );

  restoredCounts.adminSettings = await restoreTableRows(
    rows.adminSettings,
    () => prisma.adminSettings.findMany(),
    (data: PrismaTypes.AdminSettingsCreateManyInput[]) =>
      prisma.adminSettings.createMany({ data, skipDuplicates: true }),
    (row) => {
      const key = requiredStringField(row, "key", "Backup admin setting is missing its key.");
      return {
        matchKeys: [`key:${key}`],
        createData: recordToInput<PrismaTypes.AdminSettingsCreateManyInput>(row, ["key", "totalBudget"]),
        updateOperation: () => prisma.adminSettings.update({
          where: { key },
          data: recordToInput<PrismaTypes.AdminSettingsUpdateManyMutationInput>(row, ["totalBudget"]),
        }),
      };
    },
  );

  restoredCounts.academicTermSchedules = await restoreTableRows(
    rows.academicTermSchedules,
    () => prisma.academicTermSchedule.findMany(),
    (data: PrismaTypes.AcademicTermScheduleCreateManyInput[]) =>
      prisma.academicTermSchedule.createMany({ data, skipDuplicates: true }),
    (row) => {
      const id = requiredRecordId(row);
      const fields = ["id", "semester", "opensAt", "closesAt", "createdAt", "updatedAt"];
      const dateFields = ["opensAt", "closesAt", "createdAt", "updatedAt"];
      return {
        matchKeys: [idMatchKey(id)],
        createData: recordToInput<PrismaTypes.AcademicTermScheduleCreateManyInput>(row, fields, dateFields),
        updateOperation: () => prisma.academicTermSchedule.update({
          where: { id },
          data: recordToInput<PrismaTypes.AcademicTermScheduleUncheckedUpdateInput>(row, fields.filter((field) => field !== "id"), dateFields),
        }),
      };
    },
  );

  restoredCounts.semesters = await restoreTableRows(
    rows.semesters,
    () => prisma.semester.findMany(),
    (data: PrismaTypes.SemesterCreateManyInput[]) =>
      prisma.semester.createMany({ data, skipDuplicates: true }),
    (row) => {
      const id = requiredRecordId(row);
      return {
        matchKeys: [idMatchKey(id)],
        createData: recordToInput<PrismaTypes.SemesterCreateManyInput>(row, ["id", "name", "isCurrent"]),
        updateOperation: () => prisma.semester.update({
          where: { id },
          data: recordToInput<PrismaTypes.SemesterUncheckedUpdateInput>(row, ["name", "isCurrent"]),
        }),
      };
    },
  );

  restoredCounts.reminderSettings = await restoreTableRows(
    rows.reminderSettings,
    () => prisma.reminderSetting.findMany(),
    (data: PrismaTypes.ReminderSettingCreateManyInput[]) =>
      prisma.reminderSetting.createMany({ data, skipDuplicates: true }),
    (row) => {
      const type = requiredStringField(row, "type", "Backup reminder setting is missing its type.") as ReminderType;
      const fields = ["id", "type", "offsets", "deadline", "active", "createdAt", "updatedAt"];
      const dateFields = ["deadline", "createdAt", "updatedAt"];
      return {
        matchKeys: [`type:${type}`],
        createData: recordToInput<PrismaTypes.ReminderSettingCreateManyInput>(row, fields, dateFields),
        updateOperation: () => prisma.reminderSetting.update({
          where: { type },
          data: recordToInput<PrismaTypes.ReminderSettingUpdateManyMutationInput>(row, ["offsets", "deadline", "active", "createdAt", "updatedAt"], dateFields),
        }),
      };
    },
  );

  restoredCounts.messageTemplates = await restoreTableRows(
    rows.messageTemplates,
    () => prisma.messageTemplate.findMany(),
    (data: PrismaTypes.MessageTemplateCreateManyInput[]) =>
      prisma.messageTemplate.createMany({ data, skipDuplicates: true }),
    (row) => {
      if (typeof row.type !== "string" || typeof row.channel !== "string") {
        throw new BackupSnapshotValidationError("Backup message template is missing its type or channel.");
      }
      const type = row.type as MessageTemplateType;
      const channel = row.channel as MessageTemplateChannel;
      const fields = ["id", "type", "channel", "subject", "body", "createdAt", "updatedAt"];
      const dateFields = ["createdAt", "updatedAt"];
      return {
        matchKeys: [`type:${type};channel:${channel}`],
        createData: recordToInput<PrismaTypes.MessageTemplateCreateManyInput>(row, fields, dateFields),
        updateOperation: () => prisma.messageTemplate.update({
          where: { type_channel: { type, channel } },
          data: recordToInput<PrismaTypes.MessageTemplateUpdateManyMutationInput>(row, ["subject", "body", "createdAt", "updatedAt"], dateFields),
        }),
      };
    },
  );

  await writeAuditLog(prisma, {
    action: "RESTORE_SYSTEM_BACKUP",
    actorId,
    targetTable: "backup_snapshot",
    targetId: snapshot.checksumSha256,
    afterData: { restoredCounts, restoreSummary },
    metadata: {
      checksumSha256: snapshot.checksumSha256,
      snapshotCreatedAt: snapshot.meta.createdAt,
      restoredCounts,
      restoreSummary,
    },
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

  return { restoredCounts, summary: restoreSummary };
}

export async function verifyAndRestoreBackupSnapshot({
  rawContent,
  actorId,
}: {
  rawContent: string;
  actorId: string;
}) {
  const snapshot = parseAndVerifyBackupSnapshot(rawContent);
  const result = await restoreSnapshot(snapshot, actorId);
  return { ...result, checksumSha256: snapshot.checksumSha256 };
}

export const backupTableNames = BACKUP_TABLES;
