import { describe, expect, it } from "vitest";
import { KKProfileSchema } from "../lib/kk-profile-schema";

const makeFile = (name: string, type: string, content = "document") =>
  new File([content], name, { type });

describe("KKProfileSchema", () => {
  it("requires the profile picture, birth certificate, both ID sides, and residency certificate", () => {
    const result = KKProfileSchema.safeParse({
      profilePicture: makeFile("profile.png", "image/png"),
      birthCertificate: makeFile("birth.pdf", "application/pdf"),
      validId: { front: makeFile("front.jpg", "image/jpeg") },
      certificateOfResidency: makeFile("residency.webp", "image/webp"),
    });

    expect(result.success).toBe(false);
  });

  it("allows PDFs for supporting documents", () => {
    const result = KKProfileSchema.safeParse({
      profilePicture: makeFile("profile.png", "image/png"),
      birthCertificate: makeFile("birth.pdf", "application/pdf"),
      validId: {
        front: makeFile("front.pdf", "application/pdf"),
        back: makeFile("back.png", "image/png"),
      },
      certificateOfResidency: makeFile("residency.pdf", "application/pdf"),
    });

    expect(result.success).toBe(true);
  });

  it("rejects PDFs for the profile picture", () => {
    const result = KKProfileSchema.safeParse({
      profilePicture: makeFile("profile.pdf", "application/pdf"),
      birthCertificate: makeFile("birth.pdf", "application/pdf"),
      validId: {
        front: makeFile("front.pdf", "application/pdf"),
        back: makeFile("back.png", "image/png"),
      },
      certificateOfResidency: makeFile("residency.pdf", "application/pdf"),
    });

    expect(result.success).toBe(false);
  });

  it("rejects documents larger than 10 MB", () => {
    const result = KKProfileSchema.safeParse({
      profilePicture: makeFile("profile.png", "image/png"),
      birthCertificate: makeFile("birth.jpg", "image/jpeg"),
      validId: {
        front: new File([new Uint8Array(10 * 1024 * 1024 + 1)], "front.jpg", {
          type: "image/jpeg",
        }),
        back: makeFile("back.png", "image/png"),
      },
      certificateOfResidency: makeFile("residency.png", "image/png"),
    });

    expect(result.success).toBe(false);
  });
});
