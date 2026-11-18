import { describe, expect, it } from "vitest";
import { resolveKkIdentityDocuments } from "@/lib/kk-identity-documents";

const privateDocument = (name: string) => `/api/private-documents/${name}`;

describe("resolveKkIdentityDocuments", () => {
  it("uses the latest approved KK registration documents when available", () => {
    const documents = resolveKkIdentityDocuments(
      [{
        id: "approved-registration",
        reviewStatus: "Approved",
        birthDate: new Date("2008-07-14"),
        photoFileUrl: privateDocument("photo"),
        birthCertificateFileUrl: privateDocument("birth-certificate"),
        idFrontFileUrl: privateDocument("id-front"),
        idBackFileUrl: privateDocument("id-back"),
        idSingleFileUrl: privateDocument("residency"),
      }],
      [],
    );

    expect(documents).toEqual({
      photo: privateDocument("photo"),
      birthCertificate: privateDocument("birth-certificate"),
      validIdFront: privateDocument("id-front"),
      validIdBack: privateDocument("id-back"),
      residency: privateDocument("residency"),
    });
  });

  it("fills missing KK document references from the user's approved SKEAP application", () => {
    const documents = resolveKkIdentityDocuments(
      [{
        id: "approved-registration",
        reviewStatus: "Approved",
        birthDate: new Date("2008-07-14"),
        photoFileUrl: null,
        birthCertificateFileUrl: privateDocument("new-birth-certificate"),
        idFrontFileUrl: null,
        idBackFileUrl: null,
        idSingleFileUrl: null,
      }],
      [{
        photoFileUrl: privateDocument("prior-photo"),
        uploadedFiles: {
          birthCertificate: { url: privateDocument("prior-birth-certificate") },
          kkIdFront: { url: privateDocument("prior-id-front") },
          kkIdBack: { url: privateDocument("prior-id-back") },
          barangayResidency: { url: privateDocument("prior-residency") },
        },
      }],
    );

    expect(documents).toEqual({
      photo: privateDocument("prior-photo"),
      birthCertificate: privateDocument("new-birth-certificate"),
      validIdFront: privateDocument("prior-id-front"),
      validIdBack: privateDocument("prior-id-back"),
      residency: privateDocument("prior-residency"),
    });
  });

  it("does not return untrusted or non-private document references", () => {
    const documents = resolveKkIdentityDocuments(
      [{
        id: "approved-registration",
        reviewStatus: "Approved",
        birthDate: new Date("2008-07-14"),
        photoFileUrl: "https://example.com/photo.jpg",
        birthCertificateFileUrl: null,
        idFrontFileUrl: null,
        idBackFileUrl: null,
        idSingleFileUrl: null,
      }],
      [{
        photoFileUrl: null,
        uploadedFiles: {
          birthCertificate: { url: "https://example.com/birth-certificate.pdf" },
          kkIdFront: { url: "https://example.com/id-front.jpg" },
          kkIdBack: { url: "https://example.com/id-back.jpg" },
          barangayResidency: { url: "https://example.com/residency.pdf" },
        },
      }],
    );

    expect(Object.values(documents)).toEqual([null, null, null, null, null]);
  });
});
