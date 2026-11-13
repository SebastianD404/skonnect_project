import { describe, expect, it } from "vitest";
import { buildRegistryViewCsv } from "../app/admin/registry/registry-view-csv";

describe("registry view CSV export", () => {
  it("exports only the rows supplied for the current view", () => {
    const csv = buildRegistryViewCsv([
      {
        name: "Dela Cruz, Ana",
        email: "ana@example.test",
        ageGroup: "18-24",
        classification: "In school Youth",
        skVoter: "Yes",
        skeapStatus: "Active Scholar",
      },
    ]);

    expect(csv).toContain('"Dela Cruz, Ana","ana@example.test","18-24"');
    expect(csv).not.toContain("other@example.test");
  });

  it("quotes delimiters and neutralizes spreadsheet formulas", () => {
    const csv = buildRegistryViewCsv([
      {
        name: 'Youth "One"',
        email: "=HYPERLINK(\"https://example.test\")",
        ageGroup: "18-24",
        classification: "Working Youth",
        skVoter: "No",
        skeapStatus: "KK Profile Only",
      },
    ]);

    expect(csv).toContain('"Youth ""One"""');
    expect(csv).toContain(`"'=HYPERLINK(""https://example.test"")"`);
  });
});
