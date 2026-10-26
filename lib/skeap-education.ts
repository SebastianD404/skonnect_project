export const SKEAP_EDUCATION_LEVELS = [
  "Junior High School",
  "Senior High School",
  "College",
  "Vocational",
] as const;

export const SKEAP_APPLICATION_EDUCATION_LEVELS = SKEAP_EDUCATION_LEVELS.filter(
  (level) => level !== "Vocational"
);

export type SkeapEducationLevel = (typeof SKEAP_EDUCATION_LEVELS)[number];

export const SKEAP_YEAR_LEVELS: Record<SkeapEducationLevel, readonly string[]> = {
  "Junior High School": ["Grade 7", "Grade 8", "Grade 9", "Grade 10"],
  "Senior High School": ["Grade 11", "Grade 12"],
  College: ["Incoming Freshman", "1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "6th Year"],
  Vocational: ["Incoming Freshman", "1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "6th Year"],
};

export function isSkeapEducationLevel(value: string): value is SkeapEducationLevel {
  return SKEAP_EDUCATION_LEVELS.includes(value as SkeapEducationLevel);
}

export function isValidSkeapYearLevel(educationLevel: string, yearLevel: string) {
  return isSkeapEducationLevel(educationLevel) && SKEAP_YEAR_LEVELS[educationLevel].includes(yearLevel);
}
