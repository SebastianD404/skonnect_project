import * as XLSX from "xlsx";
import { formatDate } from "@/lib/utils";

export type ExportModule = "members" | "grantees" | "kk-profiling" | "submissions";

type ExportValue = string | number;
type ExportRow = Record<string, ExportValue>;
type ExportSource = Record<string, unknown>;

interface ExcelExportFile {
  filename: string;
  body: ArrayBuffer;
}

const PROFILE_HEADERS = [
  "Name",
  "Email",
  "Contact No",
  "Age",
  "Age Group",
  "Classification",
  "Work Status",
  "SK Voter",
  "Status",
  "Submitted At",
];

const GRANTEE_HEADERS = [
  "Name",
  "Email",
  "Contact No",
  "School",
  "Year Level",
  "Status",
  "General Average",
  "Enrolled At",
  "Graduated At",
  "Retention Expires At",
];

const SUBMISSION_HEADERS = [
  "Grantee",
  "Email",
  "Semester",
  "School",
  "Year Level",
  "Average",
  "Status",
  "Submitted At",
  "COE Document",
  "Grade Report",
];

function getValue(source: ExportSource, ...keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
}

function getText(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function getDate(value: unknown): string {
  if (value instanceof Date || typeof value === "string") return formatDate(value);
  return value == null ? "—" : String(value);
}

function getName(source: ExportSource): string {
  const name = getText(getValue(source, "name", "fullName", "full_name"), "");
  if (name) return name;
  const firstName = getText(getValue(source, "first_name", "firstName"), "");
  const lastName = getText(getValue(source, "last_name", "lastName"), "");
  return `${firstName} ${lastName}`.trim() || "—";
}

function getContactNo(source: ExportSource): string {
  const contact = getValue(source, "contact_no", "contactNo", "contactNumber", "contact_number", "phone");
  return contact === null || contact === undefined || contact === "" ? "—" : String(contact);
}

function formatProfileRow(source: ExportSource): ExportRow {
  const skVoter = getValue(source, "sk_voter", "skVoter", "registeredSKVoter");
  return {
    Name: getName(source),
    Email: getText(getValue(source, "email")),
    "Contact No": getContactNo(source),
    Age: getText(getValue(source, "age")),
    "Age Group": getText(getValue(source, "age_group", "ageGroup", "youthAgeGroup")),
    Classification: getText(getValue(source, "classification", "youthClassification")),
    "Work Status": getText(getValue(source, "work_status", "workStatus")),
    "SK Voter": typeof skVoter === "boolean" ? (skVoter ? "Yes" : "No") : getText(skVoter),
    Status: getText(getValue(source, "status", "reviewStatus", "review_status")),
    "Submitted At": getDate(getValue(source, "submitted_at", "submittedAt")),
  };
}

function formatGranteeRow(source: ExportSource): ExportRow {
  const average = getValue(source, "generalAverage", "general_average");
  return {
    Name: getName(source),
    Email: getText(getValue(source, "email")),
    "Contact No": getContactNo(source),
    School: getText(getValue(source, "school")),
    "Year Level": getText(getValue(source, "yearLevel", "year_level")),
    Status: getText(getValue(source, "status")),
    "General Average": typeof average === "number" ? average : getText(average),
    "Enrolled At": getDate(getValue(source, "dateEnrolled", "date_enrolled")),
    "Graduated At": getDate(getValue(source, "graduatedAt", "graduated_at")),
    "Retention Expires At": getDate(getValue(source, "retentionExpiresAt", "retention_expires_at")),
  };
}

function formatSubmissionRow(source: ExportSource): ExportRow {
  const average = getValue(source, "generalAverage", "general_average");
  return {
    Grantee: getName(source),
    Email: getText(getValue(source, "email")),
    Semester: getText(getValue(source, "semester")),
    School: getText(getValue(source, "school")),
    "Year Level": getText(getValue(source, "yearLevel", "year_level")),
    Average: typeof average === "number" ? average : getText(average),
    Status: getText(getValue(source, "status")),
    "Submitted At": getDate(getValue(source, "submittedAt", "submitted_at")),
    "COE Document": getText(getValue(source, "coeFileUrl", "coe_file_url")),
    "Grade Report": getText(getValue(source, "gradeFileUrl", "grade_file_url")),
  };
}

export function exportToExcel<T extends object>(
  data: T[],
  filename: string,
  moduleType: ExportModule
): ExcelExportFile {
  const headers = moduleType === "grantees"
    ? GRANTEE_HEADERS
    : moduleType === "submissions"
    ? SUBMISSION_HEADERS
    : PROFILE_HEADERS;
  const formattedData = data.map((item) => {
    const source = item as ExportSource;
    return moduleType === "grantees"
      ? formatGranteeRow(source)
      : moduleType === "submissions"
      ? formatSubmissionRow(source)
      : formatProfileRow(source);
  });
  const worksheet = formattedData.length
    ? XLSX.utils.json_to_sheet(formattedData, { header: headers })
    : XLSX.utils.aoa_to_sheet([headers]);

  worksheet["!cols"] = headers.map((header) => {
    const maxLength = Math.max(
      header.length,
      ...formattedData.map((row) => String(row[header] ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLength + 5, 12), 60) };
  });

  const workbook = XLSX.utils.book_new();
  const sheetName = moduleType === "kk-profiling" ? "KK Profiling" : moduleType === "submissions" ? "Submissions" : moduleType;
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const workbookBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  const body = new ArrayBuffer(workbookBuffer.byteLength);
  new Uint8Array(body).set(workbookBuffer);
  const dateStamp = new Date().toISOString().slice(0, 10);

  return {
    filename: `${filename}-${dateStamp}.xlsx`,
    body,
  };
}
