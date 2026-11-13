export type RegistryViewCsvRow = {
  name: string;
  email: string;
  ageGroup: string;
  classification: string;
  skVoter: string;
  skeapStatus: string;
};

function escapeCsvCell(value: string) {
  const safeValue = /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

export function buildRegistryViewCsv(rows: RegistryViewCsvRow[]) {
  const csvRows = [
    ["Name", "Email", "Age Group", "Classification", "SK Voter", "SKEAP Status"],
    ...rows.map((row) => [
      row.name,
      row.email,
      row.ageGroup,
      row.classification,
      row.skVoter,
      row.skeapStatus,
    ]),
  ];

  return `\uFEFF${csvRows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}`;
}
