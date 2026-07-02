import { describe, expect, it } from "vitest";
import { getAuditRoleChangeContext, shortAuditId } from "./metadata";

describe("getAuditRoleChangeContext", () => {
  it("prefers dedicated metadata values for role changes", () => {
    const context = getAuditRoleChangeContext({
      action: "UPDATE_USER_ROLE",
      targetId: "d34db33f-7b43-4f02-bf75-c6dd11001100",
      beforeData: { role: "YOUTH", fullName: "Legacy Name" },
      afterData: { role: "SK_OFFICIAL", fullName: "Legacy Name" },
      metadata: {
        targetUserId: "f95a11c4-f303-4cbc-84d1-c4d1f0b31f11",
        targetUserName: "Jamie Santos",
        targetUserEmail: "jamie@example.com",
        oldRole: "YOUTH",
        newRole: "SK_OFFICIAL",
        ipAddress: "203.0.113.21",
        userAgent: "Mozilla/5.0",
      },
    });

    expect(context.targetUserId).toBe("f95a11c4-f303-4cbc-84d1-c4d1f0b31f11");
    expect(context.targetUserName).toBe("Jamie Santos");
    expect(context.targetUserEmail).toBe("jamie@example.com");
    expect(context.oldRole).toBe("YOUTH");
    expect(context.newRole).toBe("SK_OFFICIAL");
    expect(context.ipAddress).toBe("203.0.113.21");
  });

  it("falls back to beforeData/afterData and targetId when metadata is missing", () => {
    const context = getAuditRoleChangeContext({
      action: "UPDATE_USER_ROLE",
      targetId: "abc12345-def6-7890-abcd-ef1234567890",
      beforeData: { role: "YOUTH", fullName: "Casey Rivera", email: "casey-old@example.com" },
      afterData: { role: "GRANTEE", fullName: "Casey Rivera", email: "casey@example.com" },
    });

    expect(context.targetUserId).toBe("abc12345-def6-7890-abcd-ef1234567890");
    expect(context.targetUserName).toBe("Casey Rivera");
    expect(context.targetUserEmail).toBe("casey@example.com");
    expect(context.oldRole).toBe("YOUTH");
    expect(context.newRole).toBe("GRANTEE");
    expect(context.ipAddress).toBe("");
  });
});

describe("shortAuditId", () => {
  it("returns first 8 chars with ellipsis", () => {
    expect(shortAuditId("1234567890abcdef")).toBe("12345678...");
  });

  it("returns unknown for empty value", () => {
    expect(shortAuditId("")).toBe("unknown");
  });
});
