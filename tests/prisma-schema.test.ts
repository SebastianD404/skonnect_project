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

  it("uses the mapped users table when locking a user for inquiry submission", () => {
    const schema = readFileSync(path.resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    const inquiryRoute = readFileSync(
      path.resolve(process.cwd(), "app/api/inquiries/route.ts"),
      "utf8",
    );

    expect(schema).toMatch(/model User \{[\s\S]*?@@map\("users"\)/);
    expect(inquiryRoute).toContain('SELECT "id" FROM "users"');
  });

  it("migrates the inquiry thread fields used by the inbox APIs", () => {
    const migration = readFileSync(
      path.resolve(
        process.cwd(),
        "prisma/migrations/202611040001_add_inquiry_thread_fields/migration.sql",
      ),
      "utf8",
    );

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "reviewThread" JSONB');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "lastUpdatedBy" TEXT');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "resubmittedAt" TIMESTAMP(3)');
    expect(migration).toContain(
      `ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'Pending review'`,
    );
  });
});
