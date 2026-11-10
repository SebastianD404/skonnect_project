export type NameParts = {
  firstName: string | null | undefined;
  middleName: string | null | undefined;
  lastName: string | null | undefined;
};

export function formatDisplayName(nameParts: NameParts | null | undefined, fallbackName: string) {
  const firstName = nameParts?.firstName?.trim();
  const middleName = nameParts?.middleName?.trim();
  const lastName = nameParts?.lastName?.trim();

  const formattedName = firstName && lastName
    ? [lastName, firstName, middleName].filter(Boolean).join(", ")
    : fallbackName.trim().replace(/\s+/g, " ");

  return formattedName.toLocaleUpperCase();
}
