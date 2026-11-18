import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    notification: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    granteeMessage: {
      findFirst: vi.fn(),
    },
    grantee: {
      findFirst: vi.fn(),
    },
  };

  return {
    getUser: vi.fn(),
    ensureProfile: vi.fn(),
    transaction,
    prisma: {
      notification: { findMany: vi.fn(), count: vi.fn() },
      $transaction: vi.fn((callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction)
      ),
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock("@/lib/auth", () => ({ ensureProfile: mocks.ensureProfile }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { GET, PATCH, dynamic } from "@/app/api/my/notifications/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } } });
  mocks.ensureProfile.mockResolvedValue({ id: "user-1" });
  mocks.prisma.notification.findMany.mockResolvedValue([]);
  mocks.prisma.notification.count.mockResolvedValue(0);
  mocks.transaction.notification.count.mockResolvedValue(0);
  mocks.transaction.notification.findMany.mockResolvedValue([]);
  mocks.transaction.notification.findUnique.mockResolvedValue(null);
  mocks.transaction.notification.updateMany.mockResolvedValue({ count: 0 });
  mocks.transaction.notification.upsert.mockResolvedValue({});
  mocks.transaction.granteeMessage.findFirst.mockResolvedValue(null);
  mocks.transaction.grantee.findFirst.mockResolvedValue(null);
});

describe("my notifications route", () => {
  it("uses a dynamic, no-store GET response", async () => {
    const response = await GET();

    expect(dynamic).toBe("force-dynamic");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({
      unreadCount: 0,
      readIds: [],
      notifications: [],
    });
  });

  it("returns the unread count and read IDs from the same refresh endpoint", async () => {
    mocks.prisma.notification.findMany
      .mockResolvedValueOnce([{
        sourceKey: "unread:item-1",
        message: "Notice\nDetails",
        isRead: false,
        readAt: null,
        createdAt: new Date("2026-11-18T00:00:00.000Z"),
      }])
      .mockResolvedValueOnce([{ sourceKey: "read:item-1" }]);
    mocks.prisma.notification.count.mockResolvedValueOnce(1);

    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({
      unreadCount: 1,
      readIds: ["read:item-1"],
      notifications: [{ id: "unread:item-1", isRead: false }],
    });
  });

  it.each([
    [{ markAllRead: true }],
    [{ action: "mark_all_read" }],
  ])("marks every persisted unread notification read for %j", async (payload) => {
    const response = await PATCH(new Request("http://localhost/api/my/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      unreadCount: 0,
    });
    expect(mocks.transaction.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", isRead: false },
      data: expect.objectContaining({ isRead: true, readAt: expect.any(Date) }),
    });
  });

  it("marks the canonical graduation notification read when its synthetic message is clicked", async () => {
    mocks.transaction.notification.findMany.mockResolvedValue([
      { sourceKey: "graduation-exit-clearance:grantee-1" },
    ]);
    mocks.transaction.granteeMessage.findFirst.mockResolvedValue({
      id: "message-1",
      subject: "Congratulations, SKEAP Graduate! 🎓",
      body: "Your Exit Clearance has been verified.",
    });

    const response = await PATCH(new Request("http://localhost/api/my/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "message:message-1" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      unreadCount: 0,
      readIds: [
        "message:message-1",
        "graduation-exit-clearance:grantee-1",
        "graduation-candidate-ready:grantee-1",
      ],
    });
    expect(mocks.transaction.notification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_sourceKey: { userId: "user-1", sourceKey: "message:message-1" } },
      }),
    );
    expect(mocks.transaction.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        message: "Congratulations, SKEAP Graduate! 🎓\nYour Exit Clearance has been verified.",
      },
      data: expect.objectContaining({ isRead: true }),
    });
    expect(mocks.transaction.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        sourceKey: "graduation-candidate-ready:grantee-1",
      },
      data: expect.objectContaining({ isRead: true }),
    });
  });

  it("marks the synthetic message read when the canonical graduation item is clicked", async () => {
    mocks.transaction.notification.findUnique.mockResolvedValue({
      message: "Congratulations, SKEAP Graduate! 🎓\nYour Exit Clearance has been verified.",
    });
    mocks.transaction.granteeMessage.findFirst.mockResolvedValue({
      id: "message-1",
      subject: "Congratulations, SKEAP Graduate! 🎓",
      body: "Your Exit Clearance has been verified.",
    });

    await PATCH(new Request("http://localhost/api/my/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "graduation-exit-clearance:grantee-1" }),
    }));

    expect(mocks.transaction.notification.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.transaction.notification.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          userId_sourceKey: { userId: "user-1", sourceKey: "message:message-1" },
        },
      }),
    );
    expect(mocks.transaction.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          sourceKey: "graduation-candidate-ready:grantee-1",
        },
      }),
    );
  });

  it("clears the stale graduation-candidate notice when reading the final graduation message", async () => {
    mocks.transaction.granteeMessage.findFirst.mockResolvedValue({
      id: "message-1",
      subject: "Congratulations, SKEAP Graduate! 🎓",
      body: "Your Exit Clearance has been verified.",
    });
    mocks.transaction.grantee.findFirst.mockResolvedValue({ id: "grantee-1" });

    await PATCH(new Request("http://localhost/api/my/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "message:message-1" }),
    }));

    expect(mocks.transaction.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        sourceKey: "graduation-candidate-ready:grantee-1",
      },
      data: expect.objectContaining({ isRead: true }),
    });
  });
});
