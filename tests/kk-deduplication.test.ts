import { describe, expect, it } from "vitest";
import { assessKkProfileDuplicates } from "@/lib/kk-deduplication";

const applicant = {
  firstName: "  Ana  Marie ",
  middleName: "  Santos ",
  lastName: "Reyes",
  suffix: "Jr.",
  birthDate: new Date("2005-04-03T00:00:00.000Z"),
  sitio: "Bayabas",
};

function candidate(
  overrides: Partial<Parameters<typeof assessKkProfileDuplicates>[1][number]> = {},
) {
  return {
    ...applicant,
    userId: "another-user",
    status: "PENDING",
    ...overrides,
  };
}

describe("KK profile duplicate assessment", () => {
  it("hard-blocks an exact normalized name and birthdate match", () => {
    const result = assessKkProfileDuplicates(
      applicant,
      [
        candidate({
          firstName: "ana marie",
          middleName: "Santos",
          lastName: "REYES",
          suffix: "JR",
          birthDate: "2005-04-03",
        }),
      ],
      "current-user",
    );

    expect(result.isExactDuplicate).toBe(true);
    expect(result.duplicateFlag).toBeNull();
  });

  it("flags a same-name applicant with a different birthdate", () => {
    const result = assessKkProfileDuplicates(
      applicant,
      [candidate({ birthDate: "2006-04-03" })],
      "current-user",
    );

    expect(result.duplicateFlag).toBe("NAMESAKE_MATCH");
    expect(result.duplicateNote).toContain("different birthdate");
  });

  it("flags a different first name in the same middle/last-name household", () => {
    const result = assessKkProfileDuplicates(
      applicant,
      [candidate({ firstName: "Maria", suffix: "", sitio: "  BAYABAS  " })],
      "current-user",
    );

    expect(result.duplicateFlag).toBe("TWIN_HOUSEHOLD_MATCH");
  });

  it("ignores the same account and profiles outside pending or approved status", () => {
    const result = assessKkProfileDuplicates(
      applicant,
      [
        candidate({ userId: "current-user" }),
        candidate({ userId: "rejected-user", status: "REJECTED" }),
      ],
      "current-user",
    );

    expect(result.isExactDuplicate).toBe(false);
    expect(result.duplicateFlag).toBeNull();
  });
});
