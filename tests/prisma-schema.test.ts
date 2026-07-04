import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Prisma auth fields", () => {
  it("includes the auth profile fields used by the app", () => {
    const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
    const schema = readFileSync(schemaPath, "utf8");

    expect(schema).toContain("username      String?  @unique");
    expect(schema).toContain("mustSecureAccount    Boolean  @default(false)");
    expect(schema).toContain("usesTemporaryPassword Boolean @default(false)");
  });
});
