import { describe, expect, it } from "vitest";
import { parseApiJson } from "@/lib/parse-api-json";

describe("parseApiJson", () => {
  it("parses JSON responses", async () => {
    const response = new Response('{"ok":true}', {
      headers: { "content-type": "application/json" },
    });

    await expect(parseApiJson<{ ok: boolean }>(response, "/api/example")).resolves.toEqual({
      ok: true,
    });
  });

  it("reports HTML responses with endpoint and status instead of a JSON syntax error", async () => {
    const response = new Response("<!DOCTYPE html>", {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });

    await expect(parseApiJson(response, "/api/example")).rejects.toThrow(
      "/api/example returned HTTP 500 with text/html instead of JSON",
    );
  });

  it("reports malformed JSON responses", async () => {
    const response = new Response("<!DOCTYPE html>", {
      headers: { "content-type": "application/json" },
    });

    await expect(parseApiJson(response, "/api/example")).rejects.toThrow(
      "/api/example returned malformed JSON.",
    );
  });
});
