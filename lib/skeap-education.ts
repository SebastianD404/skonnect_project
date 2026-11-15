export const SKEAP_EDUCATION_LEVELS = [
  "Junior High School",
  "Senior High School",
  "College",
  "Vocational",
  "Technical and Vocational (Tech-Voc)",
] as const;

export const SKEAP_APPLICATION_EDUCATION_LEVELS = SKEAP_EDUCATION_LEVELS.filter(
  (level) => level !== "Vocational"
);

export const SKEAP_EDUCATION_LEVEL_OPTIONS = [
  { value: "JUNIOR_HIGH", label: "Junior High School" },
  { value: "SENIOR_HIGH", label: "Senior High School" },
  { value: "COLLEGE", label: "College" },
  { value: "TECH_VOC", label: "Technical and Vocational (Tech-Voc)" },
] as const;

export type SkeapEducationLevelCode = (typeof SKEAP_EDUCATION_LEVEL_OPTIONS)[number]["value"];

export const DEFAULT_ACTIVE_SKEAP_EDUCATION_LEVELS = [
  "JUNIOR_HIGH",
  "SENIOR_HIGH",
  "COLLEGE",
] as const satisfies readonly SkeapEducationLevelCode[];

export const ACTIVE_SKEAP_EDUCATION_LEVELS = DEFAULT_ACTIVE_SKEAP_EDUCATION_LEVELS;

export type SkeapEducationLevel = (typeof SKEAP_EDUCATION_LEVELS)[number];

export function getSkeapEducationLevelCode(value: string) {
  return SKEAP_EDUCATION_LEVEL_OPTIONS.find((option) => option.label === value)?.value ?? null;
}

export function parseSkeapEducationLevelCodes(value: unknown): SkeapEducationLevelCode[] | null {
  if (
    !Array.isArray(value) ||
    !value.every((code): code is SkeapEducationLevelCode =>
      SKEAP_EDUCATION_LEVEL_OPTIONS.some((option) => option.value === code)
    )
  ) {
    return null;
  }
  return [...new Set(value)];
}

export function getSkeapEducationLevelLabels(
  codes: readonly SkeapEducationLevelCode[],
): SkeapEducationLevel[] {
  return SKEAP_EDUCATION_LEVEL_OPTIONS
    .filter((option) => codes.includes(option.value))
    .map((option) => option.label);
}

export const SKEAP_YEAR_LEVELS: Record<SkeapEducationLevel, readonly string[]> = {
  "Junior High School": ["Grade 7", "Grade 8", "Grade 9", "Grade 10"],
  "Senior High School": ["Grade 11", "Grade 12"],
  College: ["Incoming Freshman", "1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "6th Year"],
  Vocational: ["Incoming Freshman", "1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "6th Year"],
  "Technical and Vocational (Tech-Voc)": [
    "New Trainee / Incoming",
    "1st Semester / Short Course (Min. 5 Months)",
    "1st–3rd Year TVET",
  ],
};

export function isSkeapEducationLevel(value: string): value is SkeapEducationLevel {
  return SKEAP_EDUCATION_LEVELS.includes(value as SkeapEducationLevel);
}

export function isValidSkeapYearLevel(educationLevel: string, yearLevel: string) {
  return isSkeapEducationLevel(educationLevel) && SKEAP_YEAR_LEVELS[educationLevel].includes(yearLevel);
}

export function isEligibleSkeapApplicantYearLevel(educationLevel: string, yearLevel: string) {
  return isValidSkeapYearLevel(educationLevel, yearLevel);
}
