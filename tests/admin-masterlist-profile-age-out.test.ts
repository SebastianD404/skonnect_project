import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  transaction: vi.fn(),
  findRegistration: vi.fn(),
  updateRegistration: vi.fn(),
  findUpdatedRegistration: vi.fn(),
  updateUser: vi.fn(),
  updateKkProfile: vi.fn(),
  updateGrantee: vi.fn(),
  writeAuditLog: vi.fn(),
  closeOpenApplications: vi.fn(),
  refreshKkView: vi.fn(),
  refreshSkeapView: vi.fn(),
  refreshUsersView: vi.fn(),
  revalidatePath: vi.fn(),
  notifyProfileArchived: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/audit/logger", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/kk-archive-skeap-applications", () => ({
  closeOpenSkeapApplicationsForKkArchive: mocks.closeOpenApplications,
}));
vi.mock("@/lib/application-admin-view-refresh", () => ({
  refreshKkProfilingApplicationsAdminView: mocks.refreshKkView,
  refreshSkeapApplicationsAdminView: mocks.refreshSkeapView,
  refreshSystemUsersAdminView: mocks.refreshUsersView,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/notify-profile-archived", () => ({
  notifyProfileArchived: mocks.notifyProfileArchived,
}));

import { PUT } from "@/app/api/admin/registry/masterlist/[id]/route";
import { GranteeStatus } from "@prisma/client";
import { getExactAge } from "@/lib/skeap-age";
import {
  KK_MEMBER_AGE_OUT_SCHOLAR_REMARK,
  KK_MEMBER_MANUAL_AGE_OUT_REASON,
} from "@/lib/kk-member-archive";

const tx = {
  profilingRegistration: {
    findUnique: mocks.findRegistration,
    updateMany: mocks.updateRegistration,
    findUniqueOrThrow: mocks.findUpdatedRegistration,
  },
  user: { update: mocks.updateUser },
  kKProfile: { update: mocks.updateKkProfile },
  grantee: { updateMany: mocks.updateGrantee },
};

const existingRegistration = {
  id: "registration-1",
  userId: "member-1",
  reviewStatus: "Approved",
  archivedReason: null,
  archivedAt: null,
  fullName: "Example Member",
  address: "Old Address",
  sex: "Female",
  age: 30,
  birthDate: new Date("1995-01-01T00:00:00.000Z"),
  contactNumber: "555-0100",
  youthClassification: "Student",
  youthAgeGroup: "25–30: Young Adult",
  registeredSKVoter: "Yes",
  user: {
    id: "member-1",
    email: "member@example.test",
    grantee: { id: "grantee-1", status: GranteeStatus.ACTIVE, remarks: null },
    kkProfile: {
      id: "kk-profile-1",
      firstName: "Example",
      middleName: null,
      lastName: "Member",
      fullName: "Example Member",
      purok: "Purok 1",
      addressLine: "Old Address",
      barangay: "Pico",
      birthDate: new Date("1995-01-01T00:00:00.000Z"),
      placeOfBirth: null,
      contactNumber: "555-0100",
      sex: "FEMALE",
      email: "member@example.test",
    },
  },
};

async function putProfile(confirmActiveScholarAgeOut = false) {
  return PUT(
    new Request("http://localhost/api/admin/registry/masterlist/registration-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Example Member",
        birthDate: "1990-01-01",
        sex: "Female",
        youthClassification: "Student",
        address: "New Address",
        sitio: "Purok 2",
        contactNumber: "555-0101",
        registeredSKVoter: "Yes",
        age: 12,
        confirmActiveScholarAgeOut,
      }),
    }),
    { params: Promise.resolve({ id: "registration-1" }) },
  );
}

describe("masterlist profile age-out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ id: "admin-1" });
    mocks.findRegistration.mockResolvedValue(existingRegistration);
    mocks.updateRegistration.mockResolvedValue({ count: 1 });
    mocks.findUpdatedRegistration.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      ...existingRegistration,
      id: where.id,
      reviewStatus: "Archived",
      archivedReason: KK_MEMBER_MANUAL_AGE_OUT_REASON,
      archivedAt: new Date(),
      archivedBy: "admin-1",
    }));
    mocks.updateUser.mockResolvedValue({});
    mocks.updateKkProfile.mockResolvedValue({});
    mocks.updateGrantee.mockResolvedValue({ count: 1 });
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.closeOpenApplications.mockResolvedValue(undefined);
    mocks.refreshKkView.mockResolvedValue(undefined);
    mocks.refreshSkeapView.mockResolvedValue(undefined);
    mocks.refreshUsersView.mockResolvedValue(undefined);
    mocks.notifyProfileArchived.mockResolvedValue({
      emailStatus: "SENT",
      inAppStatus: "SENT",
    });
    mocks.transaction.mockImplementation(async (callback) => callback(tx as never));
  });

  it("requires confirmation before changing an active scholar to age-out status", async () => {
    const response = await putProfile();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "ACTIVE_SCHOLAR_CONFIRMATION_REQUIRED",
    });
    expect(mocks.updateRegistration).not.toHaveBeenCalled();
    expect(mocks.updateGrantee).not.toHaveBeenCalled();
  });

  it("recalculates age on the server and archives the profile after confirmation", async () => {
    const response = await putProfile(true);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.updateRegistration).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        age: getExactAge(new Date("1990-01-01T00:00:00.000Z")),
        reviewStatus: "Archived",
        archivedReason: KK_MEMBER_MANUAL_AGE_OUT_REASON,
      }),
    }));
    expect(mocks.updateGrantee).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: GranteeStatus.REMOVED,
        remarks: KK_MEMBER_AGE_OUT_SCHOLAR_REMARK,
      }),
    }));
    expect(mocks.closeOpenApplications).toHaveBeenCalledOnce();
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "PROFILE_ARCHIVED",
    }));
    expect(payload).toMatchObject({
      reviewStatus: "Archived",
      archivedReason: KK_MEMBER_MANUAL_AGE_OUT_REASON,
      skeapStatus: "AGED_OUT_CONCLUDED",
      archiveNotification: {
        emailStatus: "SENT",
        inAppStatus: "SENT",
      },
    });
    expect(mocks.notifyProfileArchived).toHaveBeenCalledWith(expect.objectContaining({
      userId: "member-1",
      email: "member@example.test",
      archiveType: "AGED_OUT",
      reason: KK_MEMBER_MANUAL_AGE_OUT_REASON,
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/registry/masterlist");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/members/records");
  });
});
