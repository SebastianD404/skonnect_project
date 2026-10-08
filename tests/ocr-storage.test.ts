import { afterEach, describe, expect, it } from "vitest";
import {
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
  });

  it("rejects legacy public URLs from the runtime signed-file path", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    expect(() =>
      getSubmissionStorageObject(
        "https://project.supabase.co/storage/v1/object/public/public%20image/grantee-submissions/auth-1/report.pdf",
        "auth-1"
      )
    ).toThrow("migrated to private storage");
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
