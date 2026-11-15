export function isSkeapApplicationRejected(reviewStatus: string | null | undefined): boolean {
  return /reject/i.test(reviewStatus?.trim() ?? "");
}

export function isSkeapApplicationReturned(reviewStatus: string | null | undefined): boolean {
  const normalized = (reviewStatus?.trim() ?? "").toUpperCase().replace(/[\s-]+/g, "_");
  return ["RETURNED", "NEEDS_REVISION", "RETURNED_FOR_EDIT"].includes(normalized);
}

export function isSkeapUploadMarkedForCorrection(
  reviewThread: Array<{
    role: string;
    action?: string;
    attachments?: Array<{ fileId?: string; fileUrl?: string }>;
  }>,
  file: { slotId: string; originalUrl: string },
) {
  const latestReturn = reviewThread.find(
    (message) => message.role === "admin" && message.action === "return",
  );
  const returnMessage =
    latestReturn ??
    reviewThread.find(
      (message) => message.role === "admin" && (message.attachments?.length ?? 0) > 0,
    );
  if (!returnMessage) return false;

  return Boolean(
    returnMessage.attachments?.some(
      (attachment) =>
        (Boolean(file.slotId) && attachment.fileId === file.slotId) ||
        (Boolean(file.originalUrl) && attachment.fileUrl === file.originalUrl),
    ),
  );
}
