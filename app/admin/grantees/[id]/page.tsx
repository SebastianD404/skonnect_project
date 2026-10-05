import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { hasGranteeRetentionColumn, prisma } from "@/lib/prisma";
import { getRetentionExpiryDate } from "@/lib/grantee-retention";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { OFFICIAL_SITIOS } from "@/lib/kk";
import { ArrowLeft } from "lucide-react";
import GranteeDossierView, {
  type SerializableSkeapApplicationFormPayload,
} from "./GranteeDossierView";
import GranteeDetailErrorState from "./GranteeDetailErrorState";

type Props = {
  params: Promise<{
    id?: string | string[];
  }>;
};

export default async function AdminGranteeDetailPage({ params }: Props) {
  const { id } = await params;
  const rawId = Array.isArray(id) ? id[0] : id;
  const granteeId = rawId?.startsWith("user-") ? rawId.slice(5) : rawId;

  if (!granteeId) {
    notFound();
  }

  let granteeData;
  try {
    const hasRetentionColumn = await hasGranteeRetentionColumn();
    const grantee = await prisma.grantee.findUnique({
      where: { id: granteeId },
      select: {
        id: true,
        userId: true,
        status: true,
        school: true,
        yearLevel: true,
        generalAverage: true,
        dateEnrolled: true,
        graduatedAt: true,
        ...(hasRetentionColumn ? { retentionExpiresAt: true } : {}),
        user: {
          select: {
            fullName: true,
            email: true,
            phoneNumber: true,
            avatarUrl: true,
            barangay: true,
            kkProfile: {
              select: {
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
                inquiry: { select: { id: true } },
              },
            },
          },
        },
        submissions: {
          orderBy: { submittedAt: "desc" },
          take: 5,
        },
      },
    });

    if (!grantee) {
      notFound();
    }

    granteeData = { grantee };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Failed to load grantee details:", error);
    return <GranteeDetailErrorState />;
  }

  const { grantee } = granteeData;
  const skeapApplication = grantee.user.skeapApplications[0] ?? null;
  const addressLineParts = (grantee.user.kkProfile?.addressLine ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => Boolean(part) && part.toLowerCase() !== "address pending verification");
  const purokParts = (grantee.user.kkProfile?.purok ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const isSitio = (part: string) =>
    OFFICIAL_SITIOS.some((sitio) => sitio.toLowerCase() === part.toLowerCase());
  const isBarangay = (part: string) =>
    part.replace(/\./g, "").replace(/^(barangay|brgy)\s+/i, "").trim().toLowerCase() ===
    (grantee.user.kkProfile?.barangay || grantee.user.barangay).replace(/\./g, "").trim().toLowerCase();
  const sitio =
    [...purokParts, ...addressLineParts].find(isSitio) ??
    purokParts.find((part) => !isBarangay(part)) ??
    null;
  const localityParts = addressLineParts.filter((part) => !isSitio(part) && !isBarangay(part));
  const [municipality, ...provinceParts] = localityParts;
  const isGraduated = grantee.status === "GRADUATED";
  const retentionExpiryDate = getRetentionExpiryDate(grantee);
  const serializedSkeapApplication: SerializableSkeapApplicationFormPayload | null =
    !skeapApplication
      ? null
      : {
          currentCourse: skeapApplication.currentCourse,
          yearLevel: skeapApplication.yearLevel,
          gwa: skeapApplication.gwa,
          applicantName: skeapApplication.applicantName ?? undefined,
          permanentAddress: skeapApplication.permanentAddress ?? undefined,
          dateOfBirth: skeapApplication.dateOfBirth?.toISOString() ?? undefined,
          placeOfBirth: skeapApplication.placeOfBirth ?? undefined,
          age: skeapApplication.age ?? undefined,
          civilStatus: skeapApplication.civilStatus ?? undefined,
          gender: skeapApplication.gender ?? undefined,
          fathersName: skeapApplication.fathersName ?? undefined,
          fathersOccupation: skeapApplication.fathersOccupation ?? undefined,
          fathersContact: skeapApplication.fathersContact ?? undefined,
          mothersMaidenName: skeapApplication.mothersMaidenName ?? undefined,
          mothersOccupation: skeapApplication.mothersOccupation ?? undefined,
          mothersContact: skeapApplication.mothersContact ?? undefined,
          contactNumber: skeapApplication.contactNumber ?? undefined,
          emailAddress: skeapApplication.emailAddress ?? undefined,
          photoFileUrl: skeapApplication.photoFileUrl ?? undefined,
          uploadedFiles: skeapApplication.uploadedFiles ?? undefined,
          grades: serializeGrades(skeapApplication.grades),
          timeline: serializeTimeline(skeapApplication.timeline),
        };

  return (
    <div>
      <header className="mb-6">
        <Link
          href="/admin/grantees"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to grantees
        </Link>
        {isGraduated ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-900">
              Archived record: term completed {grantee.graduatedAt?.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) ?? "on an unrecorded date"}.
            </p>
            {retentionExpiryDate ? (
              <p className="mt-1 text-xs text-emerald-800">
                Retention period ends {retentionExpiryDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
              </p>
            ) : null}
          </div>
        ) : null}
      </header>

      <GranteeDossierView
        grantee={{
          id: grantee.id,
          fullName: grantee.user.fullName,
          email: grantee.user.email,
          phoneNumber: grantee.user.phoneNumber,
          avatarUrl: grantee.user.avatarUrl,
          permanentAddress: {
            sitio,
            barangay: grantee.user.kkProfile?.barangay || grantee.user.barangay,
            municipality: municipality ?? null,
            province: provinceParts.join(", ") || null,
          },
          school: normalizeSkeapSchoolName(grantee.school),
          yearLevel: grantee.yearLevel,
          status: grantee.status,
          dateEnrolled: grantee.dateEnrolled.toISOString(),
          graduatedAt: grantee.graduatedAt?.toISOString() ?? null,
          generalAverage: grantee.generalAverage,
          submissions: grantee.submissions.map((submission) => ({
            id: submission.id,
            semester: submission.semester,
            status: submission.status,
            submittedAt: submission.submittedAt.toISOString(),
          })),
        }}
        application={serializedSkeapApplication}
        downloadHref={
          skeapApplication
            ? `/api/admin/skeap-applications/${skeapApplication.id}/download`
            : undefined
        }
      />
    </div>
  );
}

function serializeGrades(value: Prisma.JsonValue | null): SerializableSkeapApplicationFormPayload["grades"] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.flatMap((entry) => {
    if (entry === null || Array.isArray(entry) || typeof entry !== "object") {
      return [];
    }

    const subject = typeof entry.subject === "string" ? entry.subject : undefined;
    const grade =
      typeof entry.grade === "string" || typeof entry.grade === "number" ? entry.grade : undefined;
    return [{ subject, grade }];
  });
}

function serializeTimeline(value: Prisma.JsonValue | null): SerializableSkeapApplicationFormPayload["timeline"] {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return null;
  }

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
