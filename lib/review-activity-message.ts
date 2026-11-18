export function formatReviewActivityMessage(message: string) {
  const formattedLines: string[] = [];
  let insertedSupportingDocuments = false;

  for (const rawLine of message.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/uploaded files\s*:/i.test(line) || /\/api\/private-documents\//i.test(line)) {
      if (!insertedSupportingDocuments) {
        formattedLines.push("Supporting documents attached.");
        insertedSupportingDocuments = true;
      }
      continue;
    }

    if (formattedLines[formattedLines.length - 1] === line) continue;
    formattedLines.push(line);
  }

  return formattedLines.join("\n").trim();
}
