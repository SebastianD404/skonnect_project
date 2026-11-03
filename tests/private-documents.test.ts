import { describe, expect, it } from "vitest";
import { getPrivateDocumentPath } from "@/lib/private-documents";

describe("private document URL parsing", () => {
  it("accepts links scoped to supported private-document categories", () => {
    expect(
      getPrivateDocumentPath("/api/private-documents/kk-verification/user-id/front-id.png"),
    ).toBe("kk-verification/user-id/front-id.png");
    expect(
      getPrivateDocumentPath("/api/private-documents/skeap-applications/user-id/report.pdf"),
    ).toBe("skeap-applications/user-id/report.pdf");
  });

  it("rejects unsupported, incomplete, and traversal paths", () => {
    expect(getPrivateDocumentPath("/api/private-documents/avatars/user-id/photo.png")).toBeNull();
    expect(getPrivateDocumentPath("/api/private-documents/kk-verification/user-id")).toBeNull();
    expect(
      getPrivateDocumentPath("/api/private-documents/kk-verification/user-id/%2e%2e%2Fsecret"),
    ).toBeNull();
  });
});
