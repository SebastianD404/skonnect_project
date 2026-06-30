import { NextRequest } from "next/server";

function getFilenameFromUrl(url: string) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    const last = parts.pop() || "file";
    return decodeURIComponent(last);
  } catch (e) {
    const parts = url.split("/");
    return decodeURIComponent(parts.pop() || "file");
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url") ?? "";
    if (!url) return new Response(JSON.stringify({ error: "Missing url" }), { status: 400, headers: { "Content-Type": "application/json" } });

    // Allowlist basic storage hosts - adjust as needed
    const allowedHosts = ["supabase.co", "storage.googleapis.com", "cdn.jsdelivr.net"];
    let hostname = "";
    try {
      hostname = new URL(url).hostname;
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid url" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    if (!allowedHosts.some((h) => hostname.includes(h))) {
      return new Response(JSON.stringify({ error: "Host not allowed" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    const res = await fetch(url);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Failed fetching file" }), { status: res.status, headers: { "Content-Type": "application/json" } });
    }

    const filename = getFilenameFromUrl(url).replace(/[^a-zA-Z0-9_.-]/g, "_");
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const isImage = contentType.startsWith("image/");

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      // Serve images inline so they can be embedded in the gallery; other files are served as attachments
      "Content-Disposition": `${isImage ? "inline" : "attachment"}; filename="${filename}"`,
    };

    return new Response(res.body, { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
