import { describe, expect, it } from "vitest";
import { matchesAccountingNameQuery } from "@/lib/accounting-name-search";

describe("matchesAccountingNameQuery", () => {
  const names = ["ACOSTA, ALDRIN, JAY MAXUIN", "Aldrin Pogi Acosta"];

  it("matches the account name when the displayed KK profile name differs", () => {
    expect(matchesAccountingNameQuery("Aldrin Pogi Acosta", names)).toBe(true);
  });

  it("matches reordered multi-word searches case-insensitively", () => {
    expect(matchesAccountingNameQuery("Acosta Pogi Aldrin", names)).toBe(true);
  });

  it("matches any term in either name and treats an empty query as a match", () => {
    expect(matchesAccountingNameQuery("Maxuin", names)).toBe(true);
    expect(matchesAccountingNameQuery("Unrelated Person", names)).toBe(false);
    expect(matchesAccountingNameQuery("  ", names)).toBe(true);
  });
});
