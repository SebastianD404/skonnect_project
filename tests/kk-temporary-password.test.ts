import { describe, expect, it } from "vitest";
import { buildTemporaryPassword } from "../lib/kk";

describe("buildTemporaryPassword", () => {
  it("generates an easy-to-type temporary password with mixed case and numbers", () => {
    const first = buildTemporaryPassword();
    const second = buildTemporaryPassword();

    expect(first).toMatch(/^Pico-(?:[A-Z][a-z]+-){3}[A-Z][a-z]+-\d{6}$/);
    expect(first).toMatch(/[A-Z]/);
    expect(first).toMatch(/[a-z]/);
    expect(first).toMatch(/\d/);
    expect(first.length).toBeLessThan(48);
    expect(second).not.toBe(first);
  });
});
