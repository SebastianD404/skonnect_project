export async function parseApiJson<T>(
  response: Response,
  endpoint: string,
): Promise<T> {
  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  const isJson = contentType === "application/json" || contentType?.endsWith("+json");

  if (!isJson) {
    const path = response.url ? new URL(response.url).pathname : endpoint;
    const redirectNote = response.redirected ? " after a redirect" : "";
    throw new Error(
      `${endpoint} returned HTTP ${response.status} with ${contentType || "no content type"} instead of JSON${redirectNote} (${path}).`,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`${endpoint} returned malformed JSON.`);
  }
}
