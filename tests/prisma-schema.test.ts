import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Prisma auth fields", () => {
  it("includes the auth profile fields used by the app", () => {
    const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
    const schema = readFileSync(schemaPath, "utf8");

    // Normalize whitespace to make assertions robust to formatting changes
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    const normalized = norm(schema);

    expect(normalized).toContain("username String? @unique");
    expect(normalized).toContain("mustSecureAccount Boolean @default(false)");
    expect(normalized).toContain("usesTemporaryPassword Boolean @default(false)");
  });
});
