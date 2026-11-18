import { SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeUploadedFiles, SKEAP_UPLOAD_KEY } from "@/lib/skeap-upload";

export type KkIdentityDocumentReferences = {
  photo: string | null;
  birthCertificate: string | null;
  validIdFront: string | null;
  validIdBack: string | null;
  residency: string | null;
};

export type CompleteKkIdentityDocuments = {
  [Key in keyof KkIdentityDocumentReferences]: string;
};

type ApprovedKkRegistration = {
  id: string;
  reviewStatus: string;
  birthDate: Date;
  photoFileUrl: string | null;
  birthCertificateFileUrl: string | null;
  idFrontFileUrl: string | null;
  idBackFileUrl: string | null;
  idSingleFileUrl: string | null;
};

type ApprovedSkeapApplication = {
  photoFileUrl: string | null;
  uploadedFiles: unknown;
};

function privateDocumentUrl(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("/api/private-documents/")
    ? value
    : null;
}

function firstPrivateDocumentUrl(values: unknown[]) {
  return values.map(privateDocumentUrl).find((value) => value !== null) ?? null;
}

export function resolveKkIdentityDocuments(
  registrations: ApprovedKkRegistration[],
  applications: ApprovedSkeapApplication[],
): KkIdentityDocumentReferences {
  const applicationUploads = applications.map(
    (application) => normalizeUploadedFiles(application.uploadedFiles) ?? {},
  );

  return {
    photo: firstPrivateDocumentUrl([
      ...registrations.map((registration) => registration.photoFileUrl),
      ...applications.flatMap((application, index) => [
        application.photoFileUrl,
        applicationUploads[index][SKEAP_UPLOAD_KEY.PHOTO]?.url,
      ]),
    ]),
    birthCertificate: firstPrivateDocumentUrl([
      ...registrations.map((registration) => registration.birthCertificateFileUrl),
      ...applicationUploads.map((uploads) => uploads[SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE]?.url),
    ]),
    validIdFront: firstPrivateDocumentUrl([
      ...registrations.map((registration) => registration.idFrontFileUrl),
      ...applicationUploads.map((uploads) => uploads[SKEAP_UPLOAD_KEY.KK_ID_FRONT]?.url),
    ]),
    validIdBack: firstPrivateDocumentUrl([
      ...registrations.map((registration) => registration.idBackFileUrl),
      ...applicationUploads.map((uploads) => uploads[SKEAP_UPLOAD_KEY.KK_ID_BACK]?.url),
    ]),
    residency: firstPrivateDocumentUrl([
      ...registrations.map((registration) => registration.idSingleFileUrl),
      ...applicationUploads.map((uploads) => uploads[SKEAP_UPLOAD_KEY.BARANGAY_RESIDENCY]?.url),
    ]),
  };
}

export function hasCompleteKkIdentityDocuments(
  documents: KkIdentityDocumentReferences,
): documents is CompleteKkIdentityDocuments {
  return Object.values(documents).every((url) => url !== null);
}

export async function getApprovedKkProfileIdentity(userId: string) {
  const [registrations, applications] = await Promise.all([
    prisma.profilingRegistration.findMany({
      where: {
        userId,
        reviewStatus: { equals: "Approved", mode: "insensitive" },
      },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        reviewStatus: true,
        birthDate: true,
        photoFileUrl: true,
        birthCertificateFileUrl: true,
        idFrontFileUrl: true,
        idBackFileUrl: true,
        idSingleFileUrl: true,
      },
    }),
    prisma.skeapApplication.findMany({
      where: { userId, status: SubmissionStatus.APPROVED },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      select: { photoFileUrl: true, uploadedFiles: true },
    }),
  ]);

  return {
    registration: registrations[0] ?? null,
    documents: resolveKkIdentityDocuments(registrations, applications),
  };
}
