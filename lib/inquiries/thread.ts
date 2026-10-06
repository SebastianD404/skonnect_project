export interface InquiryThreadEntry {
  id: string;
  role: "admin" | "applicant";
  createdAt: string;
  text: string;
}

export function ensureThreadMessage<T extends InquiryThreadEntry>(
  messages: T[],
  fallback: InquiryThreadEntry
): Array<T | InquiryThreadEntry> {
  if (messages.some((message) => message.role === fallback.role && message.text === fallback.text)) {
    return messages;
  }
  return [...messages, fallback];
}
