import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  findApplication: vi.fn(),
  getPrivateDocumentPath: vi.fn(),
  downloadPrivateDocument: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ ensureProfile: mocks.ensureProfile }));
vi.mock("@/lib/prisma", () => ({
  prisma: { skeapApplication: { findFirst: mocks.findApplication } },
}));
vi.mock("@/lib/private-documents", () => ({
  getPrivateDocumentPath: mocks.getPrivateDocumentPath,
  downloadPrivateDocument: mocks.downloadPrivateDocument,
}));

import { GET } from "@/app/api/my/academic-journey-documents/[applicationId]/route";

function makeRequest(kind = "grade") {
  return new NextRequest(
    `http://localhost/api/my/academic-journey-documents/application-1?kind=${kind}&download=true&filename=Grade-Report-Y1-S1`,
  );
}

function makeContext(applicationId = "application-1") {
  return { params: Promise.resolve({ applicationId }) };
}

describe("initial academic journey document access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "profile-1", role: "GRANTEE" });
    mocks.findApplication.mockResolvedValue({
      reportCardFileUrl: "/api/private-documents/skeap-applications/auth-user-1/report.pdf",
      enrollmentFileUrl: "/api/private-documents/skeap-applications/auth-user-1/coe.pdf",
    });
    mocks.getPrivateDocumentPath.mockReturnValue("skeap-applications/auth-user-1/report.pdf");
    mocks.downloadPrivateDocument.mockResolvedValue(new Blob(["document"], { type: "application/pdf" }));
  });

  it("serves only the requesting grantee's approved application file", async () => {
    const response = await GET(makeRequest(), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.findApplication).toHaveBeenCalledWith({
      where: { id: "application-1", userId: "profile-1", status: "APPROVED" },
      select: { reportCardFileUrl: true, enrollmentFileUrl: true },
    });
    expect(mocks.downloadPrivateDocument).toHaveBeenCalledWith(
      "skeap-applications/auth-user-1/report.pdf",
    );
    expect(response.headers.get("content-disposition")).toContain("Grade-Report-Y1-S1.pdf");
    await expect(response.text()).resolves.toBe("document");
  });

  it("does not serve a stored file path owned by another auth user", async () => {
    mocks.getPrivateDocumentPath.mockReturnValue(
      "skeap-applications/another-user/report.pdf",
    );

    const response = await GET(makeRequest(), makeContext());

    expect(response.status).toBe(404);
    expect(mocks.downloadPrivateDocument).not.toHaveBeenCalled();
  });

  it("rejects non-grantee access before looking up application documents", async () => {
    mocks.ensureProfile.mockResolvedValue({ id: "profile-1", role: "YOUTH" });

    const response = await GET(makeRequest(), makeContext());

    expect(response.status).toBe(403);
    expect(mocks.findApplication).not.toHaveBeenCalled();
  });
});
