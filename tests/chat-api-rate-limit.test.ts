import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/messages/route";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
    },
  })),
}));

describe("chat messages API rate limit", () => {
  it("returns HTTP 429 for the 11th request from the same IP", async () => {
    const ip = `rate-limit-api-${crypto.randomUUID()}`;
    const makeRequest = () =>
      new NextRequest("http://localhost/api/chat/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": ip,
        },
        body: JSON.stringify({ message: "" }),
      });

    for (let requestNumber = 1; requestNumber <= 10; requestNumber += 1) {
      const response = await POST(makeRequest());
      expect(response.status, `request ${requestNumber}`).toBe(400);
    }

    const eleventhResponse = await POST(makeRequest());

    expect(eleventhResponse.status).toBe(429);
    expect(eleventhResponse.headers.get("Retry-After")).toBe("60");
    expect(await eleventhResponse.json()).toEqual({
      error: "Too many requests. Please wait before trying again.",
    });
  });
});
