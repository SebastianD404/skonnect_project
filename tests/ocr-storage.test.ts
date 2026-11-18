import { afterEach, describe, expect, it } from "vitest";
import {
  createSignedSubmissionFileUrl,
  getLegacySubmissionStorageObject,
  getSubmissionStorageObject,
} from "../lib/ocr/storage";

describe("submission storage paths", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    if (originalSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
  });

  it("accepts private owner-scoped paths for signed access", () => {
    expect(
      getSubmissionStorageObject("grantee-submissions/auth-1/report.pdf", "auth-1")
    ).toEqual({
      bucket: "grantee-submissions",
      path: "grantee-submissions/auth-1/report.pdf",
    });
    expect(getSubmissionStorageObject("auth-1/report.pdf", "auth-1")).toEqual({
      bucket: "grantee-submissions",
      path: "auth-1/report.pdf",
    });
  });

  it("extracts a private bucket path from public and signed Supabase URLs", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    expect(
      getSubmissionStorageObject(
        "https://project.supabase.co/storage/v1/object/public/grantee-submissions/grantee-submissions/auth-1/report%20card.pdf",
        "auth-1"
      )
    ).toEqual({
      bucket: "grantee-submissions",
      path: "grantee-submissions/auth-1/report card.pdf",
    });
    expect(
      getSubmissionStorageObject(
        "https://project.supabase.co/storage/v1/object/sign/grantee-submissions/grantee-submissions/auth-1/report.pdf?token=abc",
        "auth-1"
      )
    ).toEqual({
      bucket: "grantee-submissions",
      path: "grantee-submissions/auth-1/report.pdf",
    });
    expect(
      getSubmissionStorageObject(
        "/storage/v1/object/public/grantee-submissions/grantee-submissions/auth-1/report.pdf",
        "auth-1"
      )
    ).toEqual({
      bucket: "grantee-submissions",
      path: "grantee-submissions/auth-1/report.pdf",
    });
  });

  it("preserves external non-Supabase URLs without signing them", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    const externalUrl = "https://cdn.example.org/documents/report.pdf";
    await expect(createSignedSubmissionFileUrl(externalUrl, "auth-1")).resolves.toBe(externalUrl);
  });

  it("parses only the owner's legacy submission object for migration", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    expect(
      getLegacySubmissionStorageObject(
        "https://project.supabase.co/storage/v1/object/public/public%20image/grantee-submissions/auth-1/report.pdf",
        "auth-1"
      )
    ).toEqual({
      bucket: "public image",
      path: "grantee-submissions/auth-1/report.pdf",
    });
    expect(() =>
      getLegacySubmissionStorageObject(
        "https://project.supabase.co/storage/v1/object/public/public%20image/grantee-submissions/auth-2/report.pdf",
        "auth-1"
      )
    ).toThrow("path is invalid");
  });
});
