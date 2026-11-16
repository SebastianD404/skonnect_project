import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  updateInquiry: vi.fn(),
  createMessage: vi.fn(),
  upsertNotification: vi.fn(),
  writeAuditLog: vi.fn(),
  reindexWaitlist: vi.fn(),
}));

vi.mock("@/lib/audit/logger", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/skeap-waitlist", () => ({
  reindexSkeapWaitlist: mocks.reindexWaitlist,
}));

import { closeOpenSkeapApplicationsForKkArchive } from "@/lib/kk-archive-skeap-applications";

function createTransactionClient() {
  return {
    skeapApplication: {
      findMany: mocks.findMany,
      updateMany: mocks.updateMany,
    },
    inquiry: { update: mocks.updateInquiry },
    granteeMessage: { create: mocks.createMessage },
    notification: { upsert: mocks.upsertNotification },
  };
}

describe("closing SKEAP applications when a KK profile is archived", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([
      {
        id: "pending-application",
        status: "PENDING",
        submittedAt: new Date("2026-10-01T00:00:00.000Z"),
        waitlistPosition: null,
        inquiry: { id: "pending-inquiry" },
      },
      {
        id: "waitlisted-application",
        status: "WAITLISTED",
        submittedAt: new Date("2026-10-02T00:00:00.000Z"),
        waitlistPosition: 2,
        inquiry: { id: "waitlisted-inquiry" },
      },
    ]);
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.createMessage.mockResolvedValue({ id: "message-id" });
  });

  it("withdraws pending and waitlisted records and reindexes the waitlist", async () => {
    const result = await closeOpenSkeapApplicationsForKkArchive(
      createTransactionClient() as never,
      {
        userId: "youth-id",
        actorId: "admin-id",
        reason: "Deceased",
        message: "Your application was closed.",
      },
    );

    expect(result).toEqual({ closedCount: 2 });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        userId: "youth-id",
        status: { in: ["PENDING", "WAITLISTED"] },
      },
      select: expect.objectContaining({ id: true, inquiry: expect.any(Object) }),
    });
    expect(mocks.updateMany).toHaveBeenCalledTimes(2);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "WITHDRAWN",
        withdrawnAt: expect.any(Date),
        withdrawalReason: "Your application was closed.",
        waitlistPosition: null,
      }),
    }));
    expect(mocks.updateInquiry).toHaveBeenCalledTimes(2);
    expect(mocks.upsertNotification).toHaveBeenCalledTimes(2);
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(2);
    expect(mocks.reindexWaitlist).toHaveBeenCalledTimes(1);
  });
});
