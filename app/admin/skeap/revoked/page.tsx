import { GranteeStatus, Prisma, Role, SubmissionStatus } from "@prisma/client";
import { formatDisplayName } from "@/lib/display-name";
import { requireRole } from "@/lib/auth";
import { normalizeAdminTablePageSize } from "@/lib/admin-pagination";
import { prisma } from "@/lib/prisma";
import { isPermanentlyBarredFromSkeap } from "@/lib/skeap-application-guard";
import RevokedGranteesTable from "./RevokedGranteesTable";

function normalizeTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export default async function RevokedGranteesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    pageSize?: string | string[];
    q?: string | string[];
    search?: string | string[];
  }>;
}) {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const resolved = await searchParams;
  const getParam = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
  const requestedPage = Number(getParam(resolved.page) || 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const pageSize = normalizeAdminTablePageSize(Number(getParam(resolved.pageSize)));
  const query = String(getParam(resolved.q) ?? getParam(resolved.search) ?? "").trim();
  const queryTokens = normalizeTokens(query);

  const where: Prisma.GranteeWhereInput = {
    status: { in: [GranteeStatus.REMOVED, GranteeStatus.REVOKED] },
    dateRemoved: { not: null },
    ...(queryTokens.length
      ? {
          AND: queryTokens.map((token) => {
            const containsToken = { contains: token, mode: "insensitive" as const };
            return {
              OR: [
                { user: { is: { fullName: containsToken } } },
                { user: { is: { email: containsToken } } },
                { user: { is: { phoneNumber: containsToken } } },
                {
                  user: {
                    is: {
                      kkProfile: { is: { fullName: containsToken } },
                    },
                  },
                },
                {
                  user: {
                    is: {
                      kkProfile: { is: { firstName: containsToken } },
                    },
                  },
                },
                {
                  user: {
                    is: {
                      kkProfile: { is: { middleName: containsToken } },
                    },
                  },
                },
                {
                  user: {
                    is: {
                      kkProfile: { is: { lastName: containsToken } },
                    },
                  },
                },
                {
                  user: {
                    is: {
                      kkProfile: { is: { email: containsToken } },
                    },
                  },
                },
                {
                  user: {
                    is: {
                      kkProfile: { is: { purok: containsToken } },
                    },
                  },
                },
                { school: containsToken },
                { revocationReason: containsToken },
                { revocationNotes: containsToken },
                { remarks: containsToken },
                {
                  submissions: {
                    some: {
                      status: SubmissionStatus.REMOVED,
                      reviewNotes: containsToken,
                    },
                  },
                },
              ],
            };
          }),
        }
      : {}),
  };
  const totalCount = await prisma.grantee.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const grantees = totalCount > 0
    ? await prisma.grantee.findMany({
        where,
        orderBy: [{ dateRemoved: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          dateRemoved: true,
          school: true,
          yearLevel: true,
          revocationReason: true,
          revocationNotes: true,
          revocationProofPath: true,
          revocationProofType: true,
          revocationProofFileName: true,
          revocationProofHash: true,
          isPermanentlyDisqualified: true,
          remarks: true,
          user: {
            select: {
              fullName: true,
              email: true,
              phoneNumber: true,
              kkProfile: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  fullName: true,
                  email: true,
                  contactNumber: true,
                  purok: true,
                  barangay: true,
                  addressLine: true,
                },
              },
              skeapApplications: {
                orderBy: { submittedAt: "desc" },
                take: 1,
                select: {
                  id: true,
                  currentCourse: true,
                  yearLevel: true,
                  gwa: true,
                  applicantName: true,
                  permanentAddress: true,
                  dateOfBirth: true,
                  placeOfBirth: true,
                  age: true,
                  civilStatus: true,
                  gender: true,
                  fathersName: true,
                  fathersOccupation: true,
                  fathersContact: true,
                  mothersMaidenName: true,
                  mothersOccupation: true,
                  mothersContact: true,
                  contactNumber: true,
                  emailAddress: true,
                  photoFileUrl: true,
                  uploadedFiles: true,
                  grades: true,
                  timeline: true,
                },
              },
            },
          },
          submissions: {
            orderBy: { submittedAt: "desc" },
            select: {
              id: true,
              semester: true,
              status: true,
              submittedAt: true,
              gradeFileUrl: true,
              coeFileUrl: true,
              reviewNotes: true,
            },
          },
        },
      })
    : [];
  const audits = grantees.length > 0
    ? await prisma.auditLog.findMany({
        where: {
          targetTable: "grantees",
          targetId: { in: grantees.map(({ id }) => id) },
          action: "GRANTEE_STATUS_CHANGED",
        },
        orderBy: { createdAt: "desc" },
        select: {
          targetId: true,
          afterData: true,
          actor: { select: { fullName: true, email: true } },
        },
      })
    : [];
  const revokeAuditByGrantee = new Map<string, (typeof audits)[number]>();
  for (const audit of audits) {
    const afterData = audit.afterData;
    const status = afterData && typeof afterData === "object" && !Array.isArray(afterData)
      ? afterData.status
      : null;
    if (status === "REVOKED" && !revokeAuditByGrantee.has(audit.targetId)) {
      revokeAuditByGrantee.set(audit.targetId, audit);
    }

  }
  const records = grantees.flatMap((grantee) => {
    if (!grantee.dateRemoved) return [];
    const audit = revokeAuditByGrantee.get(grantee.id);
    const latestRemovedSubmission = grantee.submissions.find(
      (submission) => submission.status === SubmissionStatus.REMOVED,
    );
    const rawReason =
      grantee.revocationReason?.trim() ||
      grantee.remarks?.trim() ||
      latestRemovedSubmission?.reviewNotes?.trim() ||
      "";
    const [primaryReason, ...legacyNotes] = rawReason.split(/Additional Notes:/i);
    const application = grantee.user.skeapApplications[0] ?? null;

    return [{
      id: grantee.id,
      fullName: formatDisplayName(grantee.user.kkProfile, grantee.user.fullName),
      email: grantee.user.email,
      phoneNumber: grantee.user.phoneNumber,
      sitio: grantee.user.kkProfile?.purok ?? null,
      revokedAt: grantee.dateRemoved.toISOString(),
      reason: primaryReason.trim() || null,
      additionalNotes: grantee.revocationNotes?.trim() || legacyNotes.join("Additional Notes:").trim() || null,
      revocationProofPath: grantee.revocationProofPath,
      revocationProofType: grantee.revocationProofType,
      revocationProofFileName: grantee.revocationProofFileName,
      revocationProofHash: grantee.revocationProofHash,
      isPermanentlyBarred: isPermanentlyBarredFromSkeap({
        isPermanentlyDisqualified: grantee.isPermanentlyDisqualified,
        reason: rawReason,
      }),
      revokedBy: audit ? { fullName: audit.actor.fullName, email: audit.actor.email } : null,
      school: grantee.school,
      yearLevel: grantee.yearLevel,
      kkProfile: grantee.user.kkProfile,
      application: application
        ? {
            id: application.id,
            currentCourse: application.currentCourse,
            yearLevel: application.yearLevel,
            gwa: application.gwa,
            applicantName: application.applicantName,
            permanentAddress: application.permanentAddress,
            dateOfBirth: application.dateOfBirth?.toISOString(),
            placeOfBirth: application.placeOfBirth,
            age: application.age,
            civilStatus: application.civilStatus,
            gender: application.gender,
            fathersName: application.fathersName,
            fathersOccupation: application.fathersOccupation,
            fathersContact: application.fathersContact,
            mothersMaidenName: application.mothersMaidenName,
            mothersOccupation: application.mothersOccupation,
            mothersContact: application.mothersContact,
            contactNumber: application.contactNumber,
            emailAddress: application.emailAddress,
            photoFileUrl: application.photoFileUrl,
            uploadedFiles: application.uploadedFiles,
            grades: serializeGrades(application.grades),
            timeline: serializeTimeline(application.timeline),
          }
        : null,
      submissions: grantee.submissions.map((submission) => ({
        id: submission.id,
        semester: submission.semester,
        status: submission.status,
        submittedAt: submission.submittedAt.toISOString(),
        gradeFileUrl: submission.gradeFileUrl,
        coeFileUrl: submission.coeFileUrl,
      })),
    }];
  });

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12">
      <header>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          SKEAP Management
        </span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Revoked Grantees
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
          Review scholarships revoked from active grantees or during submission review. Graduated scholars are listed separately.
        </p>
      </header>

      <section className="flex w-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <RevokedGranteesTable
          key={query}
          records={records}
          query={query}
          page={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
        />
      </section>
    </div>
  );
}

function serializeGrades(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((entry) => {
    if (entry === null || Array.isArray(entry) || typeof entry !== "object") return [];
    const subject = typeof entry.subject === "string" ? entry.subject : undefined;
    const grade =
      typeof entry.grade === "string" || typeof entry.grade === "number" ? entry.grade : undefined;
    return [{ subject, grade }];
  });
}

function serializeTimeline(value: Prisma.JsonValue | null) {
  if (value === null || Array.isArray(value) || typeof value !== "object") return null;
  return {
    years: typeof value.years === "number" ? value.years : undefined,
    semestersPerYear: Array.isArray(value.semestersPerYear)
      ? value.semestersPerYear.filter((semester): semester is number => typeof semester === "number")
      : undefined,
    labels: Array.isArray(value.labels)
      ? value.labels.filter((label): label is string => typeof label === "string")
      : undefined,
  };
}
