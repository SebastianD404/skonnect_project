import { describe, expect, it } from "vitest";
import { ensureThreadMessage } from "@/lib/inquiries/thread";

describe("ensureThreadMessage", () => {
  it("preserves the original inquiry when official replies exist", () => {
    const original = {
      id: "inquiry-1",
      role: "applicant" as const,
      createdAt: "2026-10-07T02:00:00.000Z",
      text: "My original question",
    };
    const reply = {
      id: "admin-1",
      role: "admin" as const,
      createdAt: "2026-10-07T02:10:00.000Z",
      text: "Official response",
    };

    expect(ensureThreadMessage([reply], original)).toEqual([reply, original]);
  });

  it("does not add a duplicate original inquiry", () => {
    const original = {
      id: "inquiry-1",
      role: "applicant" as const,
      createdAt: "2026-10-07T02:00:00.000Z",
      text: "My original question",
    };

    expect(ensureThreadMessage([original], original)).toEqual([original]);
  });
});
