type DownloadReportOptions = {
  href: string;
  title: string;
  params?: Record<string, string>;
};

export async function downloadReport({ href, title, params }: DownloadReportOptions) {
  const reportUrl = new URL(href, window.location.origin);
  reportUrl.searchParams.set("format", "xlsx");
  Object.entries(params ?? {}).forEach(([key, value]) => reportUrl.searchParams.set(key, value));

  const response = await fetch(reportUrl, { credentials: "same-origin" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || `Unable to generate ${title}.`);
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const disposition = response.headers.get("Content-Disposition");
  const filename = disposition?.match(/filename="([^"]+)"/i)?.[1]
    ?? `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.xlsx`;
  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
}
