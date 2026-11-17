import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  findRegistration: vi.fn(),
  transaction: vi.fn(),
  updateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  createMessage: vi.fn(),
  createNotification: vi.fn(),
  syncKkProfile: vi.fn(),
  writeAuditLog: vi.fn(),
  refreshAdminView: vi.fn(),
  createGmailTransporter: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock("@/lib/auth", () => ({ ensureProfile: mocks.ensureProfile }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    profilingRegistration: { findUnique: mocks.findRegistration },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/audit/logger", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/broadcast-email", () => ({
  createGmailTransporter: mocks.createGmailTransporter,
  sendTransactionalEmail: mocks.sendTransactionalEmail,
}));
vi.mock("@/lib/kk-profile-sync", () => ({
  syncKkProfileFromLatestRegistration: mocks.syncKkProfile,
}));
vi.mock("@/lib/application-admin-view-refresh", () => ({
  refreshKkProfilingApplicationsAdminView: mocks.refreshAdminView,
}));

import { PUT } from "@/app/api/admin/kk-profiling/[id]/route";

const tx = {
  profilingRegistration: {
    updateMany: mocks.updateMany,
    findUniqueOrThrow: mocks.findUniqueOrThrow,
  },
  granteeMessage: { create: mocks.createMessage },
  notification: { create: mocks.createNotification },
};

function registration(reviewStatus: string) {
  return {
    id: "registration-1",
    userId: "member-1",
    fullName: "Example Member",
    address: "Pico",
    sex: "Female",
    age: 20,
    birthDate: new Date("2004-01-01"),
    email: "member@example.test",
    facebook: null,
    contactNumber: null,
    civilStatus: null,
    youthClassification: "Student",
    youthAgeGroup: "15-17",
    workStatus: null,
    educationalBackground: null,
    registeredSKVoter: "Yes",
    votedLastSK: "Yes",
    registeredNationalVoter: "Yes",
    attendedKKAssembly: "Yes",
    assemblyTimes: null,
    noAssemblyReason: null,
    consent: true,
    reviewStatus,
    reviewNotes: null,
    user: { email: "member@example.test", emailNotifications: true },
  };
}

async function putReview(payload: Record<string, unknown>) {
  const request = new NextRequest("http://localhost/api/admin/kk-profiling/registration-1", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return PUT(request, { params: Promise.resolve({ id: "registration-1" }) });
}

describe("admin KK profiling review workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "admin-1", role: "SK_OFFICIAL" });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue(registration("For Physical CTC"));
    mocks.createMessage.mockResolvedValue({ id: "message-1" });
    mocks.createNotification.mockResolvedValue({});
    mocks.syncKkProfile.mockResolvedValue(undefined);
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.refreshAdminView.mockResolvedValue(undefined);
    mocks.createGmailTransporter.mockReturnValue({});
    mocks.sendTransactionalEmail.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback) => callback(tx as never));
  });

  it("moves a pending registration to physical CTC verification and notifies the applicant", async () => {
    mocks.findRegistration.mockResolvedValue(registration("Pending"));
    mocks.findUniqueOrThrow.mockResolvedValue(registration("For Physical CTC"));

    const response = await putReview({
      reviewAction: "PASS_DIGITAL_REVIEW",
      reviewStatus: "For Physical CTC",
    });

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "registration-1", reviewStatus: "Pending" },
      data: expect.objectContaining({ reviewStatus: "For Physical CTC" }),
    }));
    expect(mocks.createMessage).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        subject: "KK Profiling: Physical CTC Verification Required",
        body: expect.stringContaining("Barangay Pico SK Office"),
      }),
    }));
    expect(mocks.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        message: expect.stringContaining("Physical CTC Verification Required"),
      }),
    }));
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      {},
      "member@example.test",
      "KK Profiling: Physical CTC Verification Required",
      expect.stringContaining("Barangay Pico SK Office"),
      "kk-profiling-registration-1-pass_digital_review",
    );
  });

  it("prevents returning a registration again while awaiting re-upload", async () => {
    mocks.findRegistration.mockResolvedValue(registration("Returned"));

    const response = await putReview({
      reviewAction: "RETURN_FOR_EDITS",
      reviewStatus: "Returned",
      reviewNotes: "Please upload a clearer document.",
    });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain("cannot be returned again");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires correction notes before starting a return action", async () => {
    mocks.findRegistration.mockResolvedValue(registration("Pending"));

    const response = await putReview({
      reviewAction: "RETURN_FOR_EDITS",
      reviewStatus: "Returned",
      reviewNotes: "  ",
    });

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("approves a registration only after physical CTC verification", async () => {
    mocks.findRegistration.mockResolvedValue(registration("For Physical CTC"));
    mocks.findUniqueOrThrow.mockResolvedValue(registration("Approved"));

    const response = await putReview({
      reviewAction: "CONFIRM_PHYSICAL_CTC",
      reviewStatus: "Approved",
    });

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "registration-1", reviewStatus: "For Physical CTC" },
      data: expect.objectContaining({ reviewStatus: "Approved" }),
    }));
    expect(mocks.syncKkProfile).toHaveBeenCalledWith(tx, "member-1");
    expect(mocks.createMessage).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        subject: "KK Profiling Application Approved",
        body: expect.stringContaining("profile is now verified"),
      }),
    }));
  });
});
