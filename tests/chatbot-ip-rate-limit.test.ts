import { describe, expect, it } from "vitest";
import { checkChatIpRateLimit } from "@/lib/chatbot/ip-rate-limit";

describe("chat IP rate limit", () => {
  it("allows ten requests per minute and rejects the eleventh", () => {
    const ip = `rate-limit-test-${crypto.randomUUID()}`;
    const now = Date.now();

    for (let request = 0; request < 10; request += 1) {
      expect(checkChatIpRateLimit(ip, now).allowed).toBe(true);
    }

    expect(checkChatIpRateLimit(ip, now)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
  });

  it("allows requests again after the one-minute window expires", () => {
    const ip = `rate-limit-test-${crypto.randomUUID()}`;
    const now = Date.now();

    for (let request = 0; request < 10; request += 1) {
      checkChatIpRateLimit(ip, now);
    }

    expect(checkChatIpRateLimit(ip, now + 60_000).allowed).toBe(true);
  });
});
