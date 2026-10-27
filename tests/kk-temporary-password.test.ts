import { describe, expect, it } from "vitest";
import { buildTemporaryPassword } from "../lib/kk";

describe("buildTemporaryPassword", () => {
  it("generates a strong, non-personal temporary password", () => {
    const first = buildTemporaryPassword();
    const second = buildTemporaryPassword();

    expect(first).toMatch(/^Pico-[0-9a-f-]{36}$/);
    expect(first).toMatch(/[A-Z]/);
    expect(first).toMatch(/[a-z]/);
    expect(first).toMatch(/\d/);
    expect(second).not.toBe(first);
  });
});
