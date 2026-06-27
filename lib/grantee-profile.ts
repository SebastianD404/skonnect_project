export const GRANTEE_PLACEHOLDER_SCHOOL = "Profile incomplete";
export const GRANTEE_PLACEHOLDER_YEAR_LEVEL = "Not set";

type GranteeProfileShape = {
  school: string;
  yearLevel: string;
} | null | undefined;

function isBlank(value: string | null | undefined) {
  return !value || value.trim().length === 0;
}

function equalsIgnoreCase(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function isGranteeProfileComplete(grantee: GranteeProfileShape) {
  if (!grantee) {
    return false;
  }

  if (isBlank(grantee.school) || isBlank(grantee.yearLevel)) {
    return false;
  }

  if (equalsIgnoreCase(grantee.school, GRANTEE_PLACEHOLDER_SCHOOL)) {
    return false;
  }

  if (equalsIgnoreCase(grantee.yearLevel, GRANTEE_PLACEHOLDER_YEAR_LEVEL)) {
    return false;
  }

  return true;
}
